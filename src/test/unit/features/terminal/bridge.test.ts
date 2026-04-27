import * as assert from "assert";
import { stripAnsi, processTerminalOutput, MAX_LAST_CMD_BYTES } from "../../../../features/terminal/bridge";

suite("stripAnsi", () => {
  test("passes through plain text unchanged", () => {
    assert.strictEqual(stripAnsi("hello world"), "hello world");
  });

  test("removes basic SGR color codes", () => {
    // \x1b[31m = red, \x1b[0m = reset
    assert.strictEqual(stripAnsi("\x1b[31mhello\x1b[0m"), "hello");
  });

  test("removes bold and multi-parameter SGR", () => {
    assert.strictEqual(stripAnsi("\x1b[1;32mgreen bold\x1b[0m"), "green bold");
  });

  test("removes cursor movement sequences", () => {
    // \x1b[2J = clear screen, \x1b[H = cursor home
    assert.strictEqual(stripAnsi("\x1b[2J\x1b[H"), "");
  });

  test("removes OSC sequences (window title etc.)", () => {
    // \x1b]0;title\x07 = set window title
    assert.strictEqual(stripAnsi("\x1b]0;My Terminal\x07hello"), "hello");
  });

  test("removes mixed sequences from real nmap output", () => {
    const raw = "\x1b[?2004h\x1b[01;32mnmap\x1b[00m \x1b[01;33m-sV\x1b[00m 10.10.10.1";
    assert.strictEqual(stripAnsi(raw), "nmap -sV 10.10.10.1");
  });

  test("handles kali zsh PS1 with unicode and color codes", () => {
    // Typical kali PS1: ┌──(kali㉿kali)-[~]\n└─$
    const prompt =
      "\x1b[1;32m┌──(\x1b[1;34mkali\x1b[1;32m㉿\x1b[1;34mkali\x1b[1;32m)-[\x1b[0;37m~\x1b[1;32m]\n└─\x1b[1;34m$\x1b[0m ";
    const result = stripAnsi(prompt);
    assert.ok(!result.includes("\x1b"), "should contain no escape sequences");
    assert.ok(result.includes("┌──"), "should preserve unicode box chars");
    assert.ok(result.includes("kali"), "should preserve text");
  });

  test("handles root hash prompt", () => {
    const prompt = "\x1b[1;31mroot@kali\x1b[0m:\x1b[1;34m/tmp\x1b[0m# ";
    const result = stripAnsi(prompt);
    assert.ok(!result.includes("\x1b"));
    assert.ok(result.includes("root@kali"));
    assert.ok(result.includes("#"));
  });

  test("strips sequences mid-output without losing surrounding text", () => {
    const output = "PORT\x1b[1m   STATE\x1b[0m   SERVICE\n22/tcp  open  ssh";
    assert.strictEqual(stripAnsi(output), "PORT   STATE   SERVICE\n22/tcp  open  ssh");
  });

  test("returns empty string for all-escape input", () => {
    assert.strictEqual(stripAnsi("\x1b[0m\x1b[1m\x1b[2J"), "");
  });
});

suite("processTerminalOutput", () => {
  test("strips ANSI and trims whitespace", () => {
    const raw = "  \x1b[32m$ nmap 10.10.10.1\x1b[0m\n\nPORT   STATE SERVICE\n22/tcp open  ssh\n\n";
    const result = processTerminalOutput(raw);
    assert.ok(!result.includes("\x1b"));
    assert.ok(!result.startsWith(" "));
    assert.ok(!result.endsWith("\n"));
    assert.ok(result.includes("PORT   STATE SERVICE"));
  });

  test("handles real-world nmap block", () => {
    const raw = [
      "$ nmap -sV 10.10.10.1",
      "Starting Nmap 7.94 ( https://nmap.org )",
      "\x1b[32mPORT\x1b[0m   STATE SERVICE VERSION",
      "22/tcp open  \x1b[1mssh\x1b[0m     OpenSSH 8.9",
      "80/tcp open  \x1b[1mhttp\x1b[0m    nginx 1.24",
      "",
    ].join("\n");
    const result = processTerminalOutput(raw);
    assert.ok(result.includes("22/tcp open  ssh     OpenSSH 8.9"));
    assert.ok(result.includes("80/tcp open  http    nginx 1.24"));
    assert.ok(!result.includes("\x1b"));
  });

  test("handles empty input", () => {
    assert.strictEqual(processTerminalOutput(""), "");
  });

  test("handles whitespace-only input", () => {
    assert.strictEqual(processTerminalOutput("   \n\n  "), "");
  });

  test("preserves multiline structure after stripping", () => {
    const raw = "\x1b[1mline1\x1b[0m\nline2\nline3";
    const result = processTerminalOutput(raw);
    assert.strictEqual(result, "line1\nline2\nline3");
  });

  test("custom PS1 output does not corrupt command output", () => {
    // Simulate what shell integration gives us: command header + raw output chunks
    // The chunks include whatever the terminal rendered, including PS1 at the end
    const raw =
      "$ whoami\n" +
      // actual command output
      "root\n" +
      // PS1 re-rendered at end (custom zsh theme)
      "\x1b[1;32m╭─\x1b[1;34mroot\x1b[1;32m@\x1b[1;34mkali\x1b[1;32m ─[\x1b[0;37m~\x1b[1;32m]\n\x1b[1;32m╰─\x1b[1;31m#\x1b[0m ";
    const result = processTerminalOutput(raw);
    assert.ok(result.includes("$ whoami"), "command header preserved");
    assert.ok(result.includes("root"), "output preserved");
    assert.ok(!result.includes("\x1b"), "no escape codes");
  });
});

// ---------------------------------------------------------------------------
// Simulate the last-command buffer cap logic used in onDidStartTerminalShellExecution.
// The TerminalBridge keeps at most MAX_LAST_CMD_BYTES bytes of the most recent
// command output in memory to prevent nc / msfconsole / tail -f from growing
// the buffer without bound.
// ---------------------------------------------------------------------------

/**
 * Mirrors the cap logic in bridge.ts so we can test it in isolation.
 * In production this runs inside the onDidStartTerminalShellExecution loop.
 */
function simulateLastCmdBuffer(chunks: string[]): string {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = "";
  for (const chunk of chunks) {
    const next = buf + chunk;
    const encoded = enc.encode(next);
    buf =
      encoded.byteLength > MAX_LAST_CMD_BYTES
        ? dec.decode(encoded.slice(-MAX_LAST_CMD_BYTES))
        : next;
  }
  return buf;
}

suite("last-command buffer cap (nc / long-running commands)", () => {
  test("small output is kept verbatim", () => {
    const chunks = ["line1\n", "line2\n", "line3\n"];
    const result = simulateLastCmdBuffer(chunks);
    assert.strictEqual(result, "line1\nline2\nline3\n");
  });

  test("buffer never exceeds MAX_LAST_CMD_BYTES", () => {
    // Generate output well beyond the cap
    const bigChunk = "A".repeat(1024); // 1KB per chunk
    const chunks = Array.from({ length: 30 }, () => bigChunk); // 30KB total > 16KB cap
    const result = simulateLastCmdBuffer(chunks);
    const enc = new TextEncoder();
    assert.ok(
      enc.encode(result).byteLength <= MAX_LAST_CMD_BYTES,
      `buffer should be ≤ ${MAX_LAST_CMD_BYTES} bytes, got ${enc.encode(result).byteLength}`
    );
  });

  test("keeps the tail, not the head", () => {
    // First part: noise that should be truncated
    const head = Array.from({ length: 20 }, (_, i) => `old-line-${i}\n`).join("");
    // Second part: the recent output that must survive
    const tail = "connection from 10.10.10.99 port 9999\nid\nuid=0(root)\n";
    // Feed head as one large chunk, tail as another
    const result = simulateLastCmdBuffer([head, tail]);
    assert.ok(result.includes("uid=0(root)"), "recent output must be preserved");
    // If the buffer was capped, the very beginning of head should be gone
    const enc = new TextEncoder();
    if (enc.encode(head + tail).byteLength > MAX_LAST_CMD_BYTES) {
      assert.ok(!result.startsWith("old-line-0"), "oldest output should have been dropped");
    }
  });

  test("many small chunks from nc reverse shell do not blow up", () => {
    // Simulate a reverse shell streaming line by line for a long time
    const enc = new TextEncoder();
    const lines = Array.from({ length: 5000 }, (_, i) => `output line ${i}\n`);
    const result = simulateLastCmdBuffer(lines);
    assert.ok(
      enc.encode(result).byteLength <= MAX_LAST_CMD_BYTES,
      "5000 lines should be capped to 16KB"
    );
    // Most recent lines must still be there
    assert.ok(result.includes("output line 4999"), "last line must survive");
  });

  test("single chunk larger than cap is truncated to tail", () => {
    const enc = new TextEncoder();
    const huge = "x".repeat(MAX_LAST_CMD_BYTES * 2);
    const result = simulateLastCmdBuffer([huge]);
    assert.ok(enc.encode(result).byteLength <= MAX_LAST_CMD_BYTES);
    // Should end with the tail of the original string
    assert.ok(result.endsWith("x".repeat(100)));
  });

  test("processTerminalOutput on capped buffer strips ANSI cleanly", () => {
    // Verify that capped buffer still works correctly with processTerminalOutput
    const chunks = [
      "\x1b[32mlistening on [any] 4444\x1b[0m\n",
      "\x1b[1mconnect to [127.0.0.1] from ...\x1b[0m\n",
      "id\n",
      "\x1b[31muid=0(root) gid=0(root)\x1b[0m\n",
    ];
    const buf = simulateLastCmdBuffer(chunks);
    const result = processTerminalOutput(buf);
    assert.ok(!result.includes("\x1b"), "no escape codes after processTerminalOutput");
    assert.ok(result.includes("uid=0(root) gid=0(root)"));
    assert.ok(result.includes("listening on [any] 4444"));
  });
});

