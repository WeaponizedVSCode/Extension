import * as assert from "assert";
import { parseFindingNote, generateFindingMarkdown, filterFindings } from "../../../../core/domain/finding";

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
    assert.deepStrictEqual(f.tags, []);
  });

  test("parses tags from frontmatter", () => {
    const content = `---
title: XSS via SVG Upload
type: finding
severity: high
tags: xss, web, owasp, file-upload
---

### XSS via SVG Upload

#### description

SVG file upload allows XSS.

#### references
`;
    const f = parseFindingNote("xss-svg", content);
    assert.deepStrictEqual(f.tags, ["xss", "web", "owasp", "file-upload"]);
  });

  test("parses single tag", () => {
    const content = `---
title: Test
type: finding
tags: privesc
---
`;
    const f = parseFindingNote("single-tag", content);
    assert.deepStrictEqual(f.tags, ["privesc"]);
  });

  test("defaults tags to empty array", () => {
    const content = `---
title: No Tags
type: finding
---
`;
    const f = parseFindingNote("no-tags", content);
    assert.deepStrictEqual(f.tags, []);
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

  test("includes tags in frontmatter", () => {
    const md = generateFindingMarkdown({
      title: "Tagged",
      tags: ["sqli", "web"],
    });
    assert.ok(md.includes("tags: sqli, web"));
  });

  test("omits tags line when no tags", () => {
    const md = generateFindingMarkdown({ title: "No Tags" });
    assert.ok(!md.includes("tags:"));
  });

  test("roundtrip: generate then parse", () => {
    const md = generateFindingMarkdown({
      title: "Roundtrip Test",
      severity: "medium",
      tags: ["ad", "kerberos"],
      description: "This is a test finding.",
      references: "ref1\nref2",
    });
    const f = parseFindingNote("roundtrip", md);
    assert.strictEqual(f.title, "Roundtrip Test");
    assert.strictEqual(f.severity, "medium");
    assert.deepStrictEqual(f.tags, ["ad", "kerberos"]);
    assert.ok(f.description.includes("This is a test finding."));
    assert.ok(f.references.includes("ref1"));
  });
});

suite("filterFindings", () => {
  const findings = [
    parseFindingNote("sqli", `---\ntitle: SQL Injection\ntype: finding\nseverity: critical\ntags: sqli, web, owasp\n---\n\n### SQL Injection\n\n#### description\n\nFound SQLi in login.\n\n#### references\n`),
    parseFindingNote("xss", `---\ntitle: Reflected XSS\ntype: finding\nseverity: high\ntags: xss, web\n---\n\n### Reflected XSS\n\n#### description\n\nXSS in search param.\n\n#### references\n`),
    parseFindingNote("privesc", `---\ntitle: Kernel Privilege Escalation\ntype: finding\nseverity: critical\ntags: privesc, linux\n---\n\n### Kernel Privilege Escalation\n\n#### description\n\nDirty pipe exploit.\n\n#### references\n`),
    parseFindingNote("info-disc", `---\ntitle: Information Disclosure\ntype: finding\nseverity: low\ntags: web, info\n---\n\n### Information Disclosure\n\n#### description\n\nServer version header exposed.\n\n#### references\n`),
  ];

  test("no filter returns all", () => {
    assert.strictEqual(filterFindings(findings, {}).length, 4);
  });

  test("filter by severity", () => {
    const result = filterFindings(findings, { severity: "critical" });
    assert.strictEqual(result.length, 2);
    assert.ok(result.every((f) => f.severity === "critical"));
  });

  test("filter by single tag", () => {
    const result = filterFindings(findings, { tags: ["web"] });
    assert.strictEqual(result.length, 3);
  });

  test("filter by multiple tags (OR)", () => {
    const result = filterFindings(findings, { tags: ["privesc", "sqli"] });
    assert.strictEqual(result.length, 2);
  });

  test("filter by query in title", () => {
    const result = filterFindings(findings, { query: "XSS" });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "xss");
  });

  test("filter by query in description", () => {
    const result = filterFindings(findings, { query: "dirty pipe" });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "privesc");
  });

  test("combined severity + tags filter", () => {
    const result = filterFindings(findings, { severity: "critical", tags: ["web"] });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "sqli");
  });

  test("no matches returns empty", () => {
    const result = filterFindings(findings, { tags: ["nonexistent"] });
    assert.strictEqual(result.length, 0);
  });

  test("tag matching is case-insensitive", () => {
    const result = filterFindings(findings, { tags: ["OWASP"] });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, "sqli");
  });
});
