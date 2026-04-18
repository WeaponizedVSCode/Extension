import * as assert from "assert";
import { parseFindingNote, generateFindingMarkdown } from "../../../../core/domain/finding";

suite("parseFindingNote", () => {
  test("parses complete finding note", () => {
    const content = `---
title: SQL Injection in Login
type: finding
severity: high
---

### SQL Injection in Login

#### description

Found SQL injection in the login form at /api/auth.

#### references

https://owasp.org/sqli
`;
    const f = parseFindingNote("sqli-login", content);
    assert.strictEqual(f.id, "sqli-login");
    assert.strictEqual(f.title, "SQL Injection in Login");
    assert.strictEqual(f.severity, "high");
    assert.ok(f.description.includes("SQL injection in the login form"));
    assert.ok(f.references.includes("owasp.org"));
  });

  test("defaults severity to info when not in frontmatter", () => {
    const content = `---
title: Open Port 445
type: finding
---

### Open Port 445

#### description

SMB port is open.

#### references
`;
    const f = parseFindingNote("open-445", content);
    assert.strictEqual(f.severity, "info");
    assert.strictEqual(f.title, "Open Port 445");
    assert.ok(f.description.includes("SMB port"));
  });

  test("captures extra frontmatter as props", () => {
    const content = `---
title: Kerberoasting
type: finding
severity: critical
host: dc01.corp.local
cve: CVE-2024-1234
---

### Kerberoasting

#### description

Kerberoastable SPN found.

#### references
`;
    const f = parseFindingNote("kerb", content);
    assert.strictEqual(f.props["host"], "dc01.corp.local");
    assert.strictEqual(f.props["cve"], "CVE-2024-1234");
    assert.strictEqual(f.severity, "critical");
  });

  test("handles empty body sections", () => {
    const content = `---
title: Empty Finding
type: finding
---

### Empty Finding

#### description


#### references
`;
    const f = parseFindingNote("empty", content);
    assert.strictEqual(f.description, "");
    assert.strictEqual(f.references, "");
  });

  test("handles content with no frontmatter", () => {
    const f = parseFindingNote("no-fm", "# Just a title\n\nSome text.");
    assert.strictEqual(f.id, "no-fm");
    assert.strictEqual(f.title, "");
    assert.strictEqual(f.severity, "info");
  });
});

suite("generateFindingMarkdown", () => {
  test("generates complete markdown with all fields", () => {
    const md = generateFindingMarkdown({
      title: "XSS in Search",
      severity: "high",
      description: "Reflected XSS found.",
      references: "https://owasp.org/xss",
    });
    assert.ok(md.includes("title: XSS in Search"));
    assert.ok(md.includes("type: finding"));
    assert.ok(md.includes("severity: high"));
    assert.ok(md.includes("#### description"));
    assert.ok(md.includes("Reflected XSS found."));
    assert.ok(md.includes("#### references"));
    assert.ok(md.includes("owasp.org/xss"));
  });

  test("defaults severity to info", () => {
    const md = generateFindingMarkdown({ title: "Test" });
    assert.ok(md.includes("severity: info"));
  });

  test("handles empty description and references", () => {
    const md = generateFindingMarkdown({ title: "Blank" });
    assert.ok(md.includes("#### description\n\n\n"));
    assert.ok(md.includes("#### references\n\n\n"));
  });

  test("roundtrip: generate then parse", () => {
    const md = generateFindingMarkdown({
      title: "Roundtrip Test",
      severity: "medium",
      description: "This is a test finding.",
      references: "ref1\nref2",
    });
    const f = parseFindingNote("roundtrip", md);
    assert.strictEqual(f.title, "Roundtrip Test");
    assert.strictEqual(f.severity, "medium");
    assert.ok(f.description.includes("This is a test finding."));
    assert.ok(f.references.includes("ref1"));
  });
});
