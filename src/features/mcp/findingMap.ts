import * as vscode from "vscode";
import { Finding, parseFindingNote, filterFindings } from "../../core/domain/finding";
import { logger } from "../../platform/vscode/logger";

const FINDING_GLOB = "findings/{*.md,*/*.md}";

interface FindingEntry {
  finding: Finding;
  uri: vscode.Uri;
}

/**
 * In-memory cache of finding notes, kept in sync via FileSystemWatcher.
 * MCP tools read from here instead of scanning disk on every request.
 */
export class FindingMap {
  private map = new Map<string, FindingEntry>();
  private disposables: vscode.Disposable[] = [];

  /** Initial scan + start watching. */
  async activate(): Promise<void> {
    await this.fullScan();
    this.watch();
    logger.info(`FindingMap activated: ${this.map.size} findings loaded`);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.map.clear();
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  getAll(): Finding[] {
    return Array.from(this.map.values()).map((e) => e.finding);
  }

  getById(id: string): Finding | undefined {
    return this.map.get(id)?.finding;
  }

  getUri(id: string): vscode.Uri | undefined {
    return this.map.get(id)?.uri;
  }

  filter(opts: { severity?: string; tags?: string[]; query?: string }): Finding[] {
    return filterFindings(this.getAll(), opts);
  }

  get size(): number {
    return this.map.size;
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  private async fullScan(): Promise<void> {
    this.map.clear();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }
    const pattern = new vscode.RelativePattern(folders[0], FINDING_GLOB);
    const files = await vscode.workspace.findFiles(pattern);
    for (const file of files) {
      await this.processFile(file);
    }
  }

  private async processFile(uri: vscode.Uri): Promise<void> {
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder().decode(raw);
      if (!content.match(/^type:\s*finding/m)) {
        return; // not a finding note
      }
      const basename = uri.path.split("/").pop()?.replace(/\.md$/, "") ?? uri.path;
      const finding = parseFindingNote(basename, content);
      this.map.set(finding.id, { finding, uri });
    } catch {
      // file unreadable — skip
    }
  }

  private removeByUri(uri: vscode.Uri): void {
    for (const [id, entry] of this.map) {
      if (entry.uri.toString() === uri.toString()) {
        this.map.delete(id);
        logger.info(`FindingMap: removed ${id}`);
        return;
      }
    }
  }

  private watch(): void {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return;
    }
    const pattern = new vscode.RelativePattern(folders[0], FINDING_GLOB);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    this.disposables.push(
      watcher,
      watcher.onDidChange(async (uri) => {
        logger.info(`FindingMap: file changed ${uri.fsPath}`);
        await this.processFile(uri);
      }),
      watcher.onDidCreate(async (uri) => {
        logger.info(`FindingMap: file created ${uri.fsPath}`);
        await this.processFile(uri);
      }),
      watcher.onDidDelete((uri) => {
        logger.info(`FindingMap: file deleted ${uri.fsPath}`);
        this.removeByUri(uri);
      })
    );
  }
}
