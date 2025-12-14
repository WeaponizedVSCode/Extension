export const enum TerminalRecorderMode {
  CommandOnly = "command-only",
  OutputOnly = "output-only",
  CommandAndOutput = "command-and-output",
  NetcatHandler = "netcat-handler",
}

export const TerminalRecorderModeList = [
  TerminalRecorderMode.CommandOnly,
  TerminalRecorderMode.OutputOnly,
  TerminalRecorderMode.CommandAndOutput,
  TerminalRecorderMode.NetcatHandler,
];
