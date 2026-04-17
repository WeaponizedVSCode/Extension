import * as vscode from "vscode";
import { logger } from "../../platform/vscode/logger";

export interface TerminalInfo {
  id: string;
  name: string;
  isActive: boolean;
  cwd?: string;
}

const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB per terminal log
const FLUSH_INTERVAL_MS = 500;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class TerminalBridge {
  private stateDir: vscode.Uri;
  private terminalsDir: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private terminalMap = new Map<vscode.Terminal, string>();
  private nextId = 1;
  private outputBuffers = new Map<string, string>();
  private flushTimer: ReturnType<typeof setInterval> | undefined;

  constructor(stateDir: vscode.Uri) {
    this.stateDir = stateDir;
    this.terminalsDir = vscode.Uri.joinPath(this.stateDir, "terminals");
  }

  async activate(): Promise<void> {
    // Ensure directories exist
    await vscode.workspace.fs.createDirectory(this.terminalsDir);

    // Track existing terminals
    for (const t of vscode.window.terminals) {
      this.trackTerminal(t);
    }

    // Track new terminals
    this.disposables.push(
      vscode.window.onDidOpenTerminal((t) => this.trackTerminal(t))
    );
    this.disposables.push(
      vscode.window.onDidCloseTerminal((t) => this.untrackTerminal(t))
    );

    // Capture command output via shell integration
    this.disposables.push(
      vscode.window.onDidStartTerminalShellExecution(async (event) => {
        const id = this.terminalMap.get(event.terminal);
        if (!id) return;
        const cmd = event.execution.commandLine.value;
        this.bufferOutput(id, `\n$ ${cmd}\n`);
        try {
          for await (const chunk of event.execution.read()) {
            this.bufferOutput(id, chunk);
          }
        } catch {
          // terminal may have closed
        }
      })
    );

    // Flush output buffers periodically
    this.flushTimer = setInterval(() => this.flushAllBuffers(), FLUSH_INTERVAL_MS);

    logger.info("TerminalBridge activated");
  }

  private trackTerminal(terminal: vscode.Terminal): void {
    const id = String(this.nextId++);
    this.terminalMap.set(terminal, id);
  }

  private untrackTerminal(terminal: vscode.Terminal): void {
    const id = this.terminalMap.get(terminal);
    this.terminalMap.delete(terminal);
    if (id) {
      this.outputBuffers.delete(id);
      const logUri = vscode.Uri.joinPath(this.terminalsDir, `${id}.log`);
      vscode.workspace.fs.delete(logUri).then(undefined, () => {});
    }
  }

  /** Returns current terminal list from in-memory state. */
  getTerminals(): TerminalInfo[] {
    const list: TerminalInfo[] = [];
    for (const [terminal, id] of this.terminalMap) {
      list.push({
        id,
        name: terminal.name,
        isActive: terminal === vscode.window.activeTerminal,
        cwd: terminal.shellIntegration?.cwd?.fsPath,
      });
    }
    return list;
  }

  /** Reads the last `lines` lines of output for a terminal (by ID or name). */
  async getTerminalOutput(id: string, lines: number = 50): Promise<string> {
    let logUri = vscode.Uri.joinPath(this.terminalsDir, `${id}.log`);
    let found = true;
    try {
      await vscode.workspace.fs.stat(logUri);
    } catch {
      found = false;
      for (const [terminal, tid] of this.terminalMap) {
        if (terminal.name === id) {
          logUri = vscode.Uri.joinPath(this.terminalsDir, `${tid}.log`);
          found = true;
          break;
        }
      }
    }
    if (!found) return `No output found for terminal ${id}`;
    try {
      const data = await vscode.workspace.fs.readFile(logUri);
      const content = decoder.decode(data);
      return content.split("\n").slice(-lines).join("\n");
    } catch {
      return `No output found for terminal ${id}`;
    }
  }

  /** Sends a command directly to a terminal without any file I/O. */
  sendCommandDirect(id: string, command: string): boolean {
    const terminal = this.findTerminal(id);
    if (terminal) {
      terminal.sendText(command);
      terminal.show(true);
      logger.info(`Sent command to terminal ${id}: ${command}`);
      return true;
    }
    logger.error(`Terminal ${id} not found`);
    return false;
  }

  private bufferOutput(id: string, text: string): void {
    const existing = this.outputBuffers.get(id) ?? "";
    this.outputBuffers.set(id, existing + text);
  }

  private async flushAllBuffers(): Promise<void> {
    for (const [id, pending] of this.outputBuffers) {
      if (!pending) continue;
      this.outputBuffers.set(id, "");
      await this.appendOutput(id, pending);
    }
  }

  private async appendOutput(id: string, text: string): Promise<void> {
    const logUri = vscode.Uri.joinPath(this.terminalsDir, `${id}.log`);
    try {
      let existing = "";
      try {
        const data = await vscode.workspace.fs.readFile(logUri);
        existing = decoder.decode(data);
      } catch {
        // file doesn't exist yet
      }
      let content = existing + text;
      // Truncate if too large (keep tail)
      if (encoder.encode(content).byteLength > MAX_OUTPUT_BYTES) {
        content = content.slice(-MAX_OUTPUT_BYTES);
      }
      await vscode.workspace.fs.writeFile(logUri, encoder.encode(content));
    } catch {
      // ignore write errors
    }
  }

  private findTerminal(id: string): vscode.Terminal | undefined {
    for (const [terminal, tid] of this.terminalMap) {
      if (tid === id) return terminal;
    }
    // Also try matching by name
    for (const [terminal] of this.terminalMap) {
      if (terminal.name === id) return terminal;
    }
    return undefined;
  }

  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Final flush
    for (const [id, pending] of this.outputBuffers) {
      if (pending) {
        this.appendOutput(id, pending);
      }
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
