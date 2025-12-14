import * as vscode from 'vscode';

export type EventListener = (
  event: vscode.TerminalShellExecutionStartEvent
) => Promise<void>;


export interface TerminalCapture {
  filePath: string;
  logLevel: string;
  listener: EventListener;
}

let TerminalCaptures: TerminalCapture[] = [];
export class TerminalCaptureRecorder {
  static get captures() {
    return TerminalCaptures;
  }
  
  static set captures(captures: TerminalCapture[]) {
    TerminalCaptures = captures;
  }
  static get length() {
    return TerminalCaptures.length;
  }

  static addCapture(capture: TerminalCapture) {
    TerminalCaptures.push(capture);
  }
  
  static removeCapture(filePath: string) {
    TerminalCaptures = TerminalCaptures.filter(
      (capture) => capture.filePath !== filePath
    );
  }
}
