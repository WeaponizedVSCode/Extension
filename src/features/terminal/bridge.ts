import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { logger } from "../../platform/vscode/logger";

interface TerminalInfo {
  id: string;
  name: string;
  isActive: boolean;
  cwd?: string;
  lastCommand?: string;
  lastExitCode?: number;
}

const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB per terminal log

export class TerminalBridge {
  private stateDir: string;
  private terminalsDir: string;
  private disposables: vscode.Disposable[] = [];
  private terminalMap = new Map<vscode.Terminal, string>(); // terminal → id
  private nextId = 1;
  private inputWatcher: fs.FSWatcher | undefined;

  constructor(workspace: vscode.WorkspaceFolder) {
    this.stateDir = path.join(workspace.uri.fsPath, ".weapon-state");
    this.terminalsDir = path.join(this.stateDir, "terminals");
  }

  activate(): void {
    // Ensure directories exist
    fs.mkdirSync(this.terminalsDir, { recursive: true });

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
    this.disposables.push(
      vscode.window.onDidChangeActiveTerminal(() => this.writeTerminalList())
    );

    // Capture command output via shell integration
    this.disposables.push(
      vscode.window.onDidStartTerminalShellExecution(async (event) => {
        const id = this.terminalMap.get(event.terminal);
        if (!id) return;
        const cmd = event.execution.commandLine.value;
        this.appendOutput(id, `\n$ ${cmd}\n`);
        try {
          for await (const chunk of event.execution.read()) {
            this.appendOutput(id, chunk);
          }
        } catch {
          // terminal may have closed
        }
        this.writeTerminalList();
      })
    );

    this.disposables.push(
      vscode.window.onDidEndTerminalShellExecution((event) => {
        const id = this.terminalMap.get(event.terminal);
        if (!id) return;
        // Update terminal list to reflect exit code changes
        this.writeTerminalList();
      })
    );

    // Watch for incoming command requests
    this.watchForInput();
    this.writeTerminalList();
    logger.info("TerminalBridge activated");
  }

  private trackTerminal(terminal: vscode.Terminal): void {
    const id = String(this.nextId++);
    this.terminalMap.set(terminal, id);
    this.writeTerminalList();
  }

  private untrackTerminal(terminal: vscode.Terminal): void {
    const id = this.terminalMap.get(terminal);
    this.terminalMap.delete(terminal);
    if (id) {
      const logPath = path.join(this.terminalsDir, `${id}.log`);
      try {
        fs.unlinkSync(logPath);
      } catch {
        /* ignore */
      }
    }
    this.writeTerminalList();
  }

  private writeTerminalList(): void {
    const list: TerminalInfo[] = [];
    for (const [terminal, id] of this.terminalMap) {
      list.push({
        id,
        name: terminal.name,
        isActive: terminal === vscode.window.activeTerminal,
        cwd: terminal.shellIntegration?.cwd?.fsPath,
      });
    }
    try {
      fs.writeFileSync(
        path.join(this.stateDir, "terminals.json"),
        JSON.stringify(list, null, 2)
      );
    } catch (e) {
      logger.error("Failed to write terminals.json", e);
    }
  }

  private appendOutput(id: string, text: string): void {
    const logPath = path.join(this.terminalsDir, `${id}.log`);
    try {
      fs.appendFileSync(logPath, text);
      // Truncate if too large (keep tail)
      const stat = fs.statSync(logPath);
      if (stat.size > MAX_OUTPUT_BYTES) {
        const content = fs.readFileSync(logPath, "utf-8");
        fs.writeFileSync(logPath, content.slice(-MAX_OUTPUT_BYTES));
      }
    } catch {
      // ignore write errors
    }
  }

  private watchForInput(): void {
    const inputFile = path.join(this.stateDir, "terminal-input.json");
    try {
      this.inputWatcher = fs.watch(this.stateDir, (_, filename) => {
        if (filename === "terminal-input.json") {
          this.processInput(inputFile);
        }
      });
    } catch {
      // fallback: poll every 2s
      const interval = setInterval(() => this.processInput(inputFile), 2000);
      this.disposables.push({ dispose: () => clearInterval(interval) });
    }
  }

  private processInput(inputFile: string): void {
    let raw: string;
    try {
      raw = fs.readFileSync(inputFile, "utf-8");
      fs.unlinkSync(inputFile); // consume the request
    } catch {
      return; // file doesn't exist or already consumed
    }

    try {
      const req = JSON.parse(raw) as { terminalId: string; command: string };
      const terminal = this.findTerminal(req.terminalId);
      if (terminal) {
        terminal.sendText(req.command);
        terminal.show(true);
        logger.info(
          `Sent command to terminal ${req.terminalId}: ${req.command}`
        );
      } else {
        logger.error(`Terminal ${req.terminalId} not found`);
      }
    } catch (e) {
      logger.error("Failed to process terminal input", e);
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
    this.inputWatcher?.close();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
