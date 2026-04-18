# 测试策略

## 当前状态

项目已具备测试基础设施（`@vscode/test-cli`、`@vscode/test-electron`、`@types/mocha`），但**尚无可见的测试文件**。对于一个管理凭据、重写文件和执行命令的安全工具而言，这是一个重大缺口。

---

## 测试金字塔

```
        ┌───────────┐
        │    E2E    │  ← VS Code integration tests (slow, few)
        │  Tests    │
       ─┼───────────┼─
       │ Integration │  ← Feature tests with mocked VS Code API (medium)
       │   Tests     │
      ─┼─────────────┼─
      │   Unit Tests  │  ← Pure logic in core/ (fast, many)
      └───────────────┘
```

**目标覆盖率：**
- `core/` — 90% 以上（纯逻辑，易于测试）
- `platform/vscode/` — 60% 以上（模拟 VS Code API）
- `features/` — 70% 以上（模拟依赖，测试逻辑）
- E2E — 仅覆盖关键路径（激活、文件同步、命令执行）

---

## 文件结构

```
src/test/
  unit/
    core/
      domain/
        host.test.ts
        user.test.ts
      env/
        collects.test.ts
      markdown/
        fencedBlocks.test.ts
        yamlBlocks.test.ts
    platform/
      variables.test.ts
      defaultCollects.test.ts
  integration/
    features/
      targets/
        sync.test.ts
        switchHost.test.ts
        switchUser.test.ts
      http/
        rawRequest.test.ts
      shell/
        runCommand.test.ts
      notes/
        reports.test.ts
      decoder/
        cyberchef.test.ts
  e2e/
    activation.test.ts
    fullWorkflow.test.ts
  fixtures/
    hosts/
      dc01.md
      web01.md
    users/
      admin.md
    services/
      smb.md
    settings.json
  helpers/
    mockVscode.ts
    testWorkspace.ts
```

---

## 单元测试

### `core/domain/host.test.ts`

```typescript
import { strict as assert } from "assert";
import { Host, parseHostsYaml, dumpHosts } from "../../../core/domain/host";

suite("Host", () => {
  test("init() with full data", () => {
    const host = new Host().init({
      hostname: "dc01.corp.local",
      ip: "10.10.10.100",
      alias: ["dc01"],
      is_dc: true,
      is_current: true,
      is_current_dc: true,
    });

    assert.equal(host.hostname, "dc01.corp.local");
    assert.equal(host.ip, "10.10.10.100");
    assert.deepEqual(host.alias, ["dc01"]);
    assert.equal(host.is_dc, true);
    assert.equal(host.is_current, true);
    assert.equal(host.is_current_dc, true);
  });

  test("init() with minimal data uses defaults", () => {
    const host = new Host().init({});
    assert.equal(host.hostname, "");
    assert.equal(host.ip, "");
    assert.equal(host.is_dc, false);
    assert.equal(host.is_current, false);
  });

  test("init() defaults alias to [hostname]", () => {
    const host = new Host().init({ hostname: "web01" });
    assert.deepEqual(host.alias, ["web01"]);
  });

  test("exportEnvironmentCollects() for current host", () => {
    const host = new Host().init({
      hostname: "dc01.corp.local",
      ip: "10.10.10.100",
      is_current: true,
    });

    const collects = host.exportEnvironmentCollects();

    assert.equal(collects["TARGET"], "10.10.10.100");
    assert.equal(collects["RHOST"], "10.10.10.100");
    assert.equal(collects["HOST"], "dc01.corp.local");
    assert.equal(collects["IP"], "10.10.10.100");
    assert.equal(collects["DOMAIN"], "dc01.corp.local");
    assert.equal(collects["CURRENT_HOST"], "dc01.corp.local");
  });

  test("exportEnvironmentCollects() for non-current host", () => {
    const host = new Host().init({
      hostname: "web01",
      ip: "10.10.10.50",
      is_current: false,
    });

    const collects = host.exportEnvironmentCollects();

    assert.ok(!("TARGET" in collects));
    assert.ok(!("RHOST" in collects));
    assert.ok("HOST_web01" in collects);
    assert.ok("IP_web01" in collects);
  });

  test("exportEnvironmentCollects() for DC host", () => {
    const host = new Host().init({
      hostname: "dc01",
      ip: "10.10.10.100",
      is_dc: true,
      is_current_dc: true,
    });

    const collects = host.exportEnvironmentCollects();

    assert.ok("DC_HOST" in collects);
    assert.ok("DC_IP" in collects);
  });

  test("exportEnvironmentCollects() promotes ENV_ props", () => {
    const host = new Host().init({
      hostname: "web01",
      ip: "10.10.10.50",
      props: { ENV_CUSTOM: "myvalue" },
    });

    const collects = host.exportEnvironmentCollects();
    assert.equal(collects["CUSTOM"], "myvalue");
  });

  test("dump() env format", () => {
    const host = new Host().init({
      hostname: "dc01",
      ip: "10.10.10.100",
    });

    const result = host.dump("env");
    assert.ok(result.includes("export"));
    assert.ok(result.includes("10.10.10.100"));
  });

  test("dump() hosts format", () => {
    const host = new Host().init({
      hostname: "dc01",
      ip: "10.10.10.100",
    });

    const result = host.dump("hosts");
    assert.ok(result.includes("10.10.10.100"));
    assert.ok(result.includes("dc01"));
  });

  test("dump() yaml format", () => {
    const host = new Host().init({
      hostname: "dc01",
      ip: "10.10.10.100",
    });

    const result = host.dump("yaml");
    assert.ok(result.includes("hostname: dc01"));
    assert.ok(result.includes("ip: 10.10.10.100"));
  });
});

suite("parseHostsYaml", () => {
  test("parses single host", () => {
    const yaml = "hostname: dc01\nip: 10.10.10.100\nis_dc: true\n";
    const hosts = parseHostsYaml(yaml);
    assert.equal(hosts.length, 1);
    assert.equal(hosts[0].hostname, "dc01");
  });

  test("parses multiple hosts (YAML list)", () => {
    const yaml = "- hostname: dc01\n  ip: 10.10.10.100\n- hostname: web01\n  ip: 10.10.10.50\n";
    const hosts = parseHostsYaml(yaml);
    assert.equal(hosts.length, 2);
  });

  test("handles empty YAML", () => {
    const hosts = parseHostsYaml("");
    assert.equal(hosts.length, 0);
  });
});

suite("dumpHosts", () => {
  test("table format with multiple hosts", () => {
    const hosts = [
      new Host().init({ hostname: "dc01", ip: "10.10.10.100", is_dc: true }),
      new Host().init({ hostname: "web01", ip: "10.10.10.50" }),
    ];

    const result = dumpHosts(hosts, "table");
    assert.ok(result.includes("dc01"));
    assert.ok(result.includes("web01"));
  });
});
```

### `core/domain/user.test.ts`

```typescript
import { strict as assert } from "assert";
import {
  UserCredential,
  parseUserCredentialsYaml,
  dumpUserCredentials,
} from "../../../core/domain/user";

suite("UserCredential", () => {
  test("init() with password", () => {
    const user = new UserCredential().init({
      user: "admin",
      password: "P@ssw0rd",
      login: "CORP\\admin",
    });

    assert.equal(user.user, "admin");
    assert.equal(user.password, "P@ssw0rd");
    assert.equal(user.login, "CORP\\admin");
  });

  test("init() with NT hash", () => {
    const user = new UserCredential().init({
      user: "admin",
      nt_hash: "aad3b435b51404eeaad3b435b51404ee",
    });

    assert.equal(user.nt_hash, "aad3b435b51404eeaad3b435b51404ee");
    assert.ok(!user.password);
  });

  test("exportEnvironmentCollects() with password for current user", () => {
    const user = new UserCredential().init({
      user: "admin",
      password: "P@ssw0rd",
      is_current: true,
    });

    const collects = user.exportEnvironmentCollects();
    assert.equal(collects["USER"], "admin");
    assert.equal(collects["PASS"], "P@ssw0rd");
    assert.equal(collects["PASSWORD"], "P@ssw0rd");
  });

  test("exportEnvironmentCollects() with NT hash for current user", () => {
    const user = new UserCredential().init({
      user: "admin",
      nt_hash: "aad3b435b51404eeaad3b435b51404ee",
      is_current: true,
    });

    const collects = user.exportEnvironmentCollects();
    assert.equal(collects["USER"], "admin");
    assert.equal(collects["NT_HASH"], "aad3b435b51404eeaad3b435b51404ee");
    assert.ok(!("PASS" in collects));
  });

  test("dumpUser() impacket format with hash", () => {
    const user = new UserCredential().init({
      user: "admin",
      login: "CORP\\admin",
      nt_hash: "aad3b435b51404eeaad3b435b51404ee",
    });

    const result = user.dumpUser("impacket");
    assert.ok(result.includes("-hashes"));
    assert.ok(result.includes("CORP\\admin") || result.includes("CORP/admin"));
  });

  test("dumpUser() nxc format with password", () => {
    const user = new UserCredential().init({
      user: "admin",
      password: "P@ssw0rd",
    });

    const result = user.dumpUser("nxc");
    assert.ok(result.includes("-u"));
    assert.ok(result.includes("-p"));
  });
});
```

### `core/markdown/fencedBlocks.test.ts`

```typescript
import { strict as assert } from "assert";
import {
  extractFencedBlocks,
  replaceFencedBlockContent,
} from "../../../core/markdown/fencedBlocks";

suite("extractFencedBlocks", () => {
  test("extracts single code block", () => {
    const md = "# Title\n\n```bash\necho hello\n```\n\nSome text";
    const blocks = extractFencedBlocks(md);

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].language, "bash");
    assert.equal(blocks[0].content.trim(), "echo hello");
    assert.equal(blocks[0].startLine, 2);
    assert.equal(blocks[0].endLine, 4);
  });

  test("extracts block with info string", () => {
    const md = "```yaml host\nhostname: dc01\nip: 10.10.10.100\n```";
    const blocks = extractFencedBlocks(md);

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].language, "yaml");
    assert.ok(blocks[0].info.includes("host"));
  });

  test("extracts multiple blocks", () => {
    const md = "```bash\ncmd1\n```\n\ntext\n\n```python\ncmd2\n```";
    const blocks = extractFencedBlocks(md);
    assert.equal(blocks.length, 2);
  });

  test("handles empty block", () => {
    const md = "```bash\n```";
    const blocks = extractFencedBlocks(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].content, "");
  });

  test("handles block with no language", () => {
    const md = "```\nplain text\n```";
    const blocks = extractFencedBlocks(md);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].language, undefined);
  });
});

suite("replaceFencedBlockContent", () => {
  test("replaces content in a block", () => {
    const md = "# Title\n\n```yaml host\nhostname: old\n```\n\nEnd";
    const blocks = extractFencedBlocks(md);
    const result = replaceFencedBlockContent(md, blocks[0], "hostname: new\n");

    assert.ok(result.includes("hostname: new"));
    assert.ok(!result.includes("hostname: old"));
    assert.ok(result.includes("# Title"));
    assert.ok(result.includes("End"));
  });

  test("preserves surrounding content", () => {
    const md = "before\n```bash\nold\n```\nafter";
    const blocks = extractFencedBlocks(md);
    const result = replaceFencedBlockContent(md, blocks[0], "new\n");

    assert.ok(result.startsWith("before"));
    assert.ok(result.includes("new"));
    assert.ok(result.endsWith("after"));
  });
});
```

### `core/env/collects.test.ts`

```typescript
import { strict as assert } from "assert";
import { envVarSafer, mergeCollects } from "../../../core/env/collects";

suite("envVarSafer", () => {
  test("replaces dots with underscores", () => {
    assert.equal(envVarSafer("dc01.corp.local"), "dc01_corp_local");
  });

  test("replaces hyphens with underscores", () => {
    assert.equal(envVarSafer("web-01"), "web_01");
  });

  test("keeps alphanumeric and underscores", () => {
    assert.equal(envVarSafer("host_01"), "host_01");
  });

  test("handles empty string", () => {
    assert.equal(envVarSafer(""), "");
  });
});

suite("mergeCollects", () => {
  test("merges two collections", () => {
    const result = mergeCollects({ A: "1" }, { B: "2" });
    assert.equal(result["A"], "1");
    assert.equal(result["B"], "2");
  });

  test("first-write-wins on conflicts", () => {
    const result = mergeCollects({ A: "first" }, { A: "second" });
    assert.equal(result["A"], "first");
  });

  test("handles empty collections", () => {
    const result = mergeCollects({}, { A: "1" }, {});
    assert.equal(result["A"], "1");
  });
});
```

---

## 集成测试

### `features/targets/sync.test.ts`

```typescript
import { strict as assert } from "assert";
// These tests need a mock VS Code API and filesystem

suite("Target Sync", () => {
  test("parses host from markdown file", async () => {
    // Create a temp workspace with a host markdown file
    // Call ProcessMarkdownFileToWorkspaceState
    // Assert Context.HostState contains the parsed host
  });

  test("parses credentials from markdown file", async () => {
    // Same but for credentials
  });

  test("deduplicates hosts by hostname", async () => {
    // Create two files with same hostname
    // Assert only one host in state
  });

  test("file watcher updates state on change", async () => {
    // Modify a markdown file
    // Assert state is updated
  });

  test("file watcher re-scans on delete", async () => {
    // Delete a markdown file
    // Assert the host/user from that file is removed
  });
});
```

### `features/notes/reports.test.ts`

```typescript
suite("Report Generator - Tarjan SCC", () => {
  test("finds strongly connected components in simple graph", () => {
    // Create a graph with known SCCs
    // Run Tarjan's algorithm
    // Assert correct SCCs
  });

  test("finds longest path in DAG", () => {
    // Create a condensed DAG
    // Run longest path
    // Assert correct path
  });

  test("generates correct Mermaid diagram", () => {
    // Create a graph with known edges
    // Generate Mermaid
    // Assert valid Mermaid syntax with expected edges
  });

  test("handles graph with no edges", () => {
    // Single node, no connections
    // Should produce minimal report
  });

  test("handles cyclic graph (SCC with > 1 node)", () => {
    // A -> B -> C -> A
    // All should be in one SCC
  });
});
```

---

## 端到端测试

### `e2e/activation.test.ts`

使用 `@vscode/test-electron`：

```typescript
import * as vscode from "vscode";
import { strict as assert } from "assert";

suite("Extension Activation", () => {
  test("extension is present", () => {
    assert.ok(
      vscode.extensions.getExtension("WeaponizedVSCode.core")
    );
  });

  test("extension activates", async () => {
    const ext = vscode.extensions.getExtension("WeaponizedVSCode.core")!;
    await ext.activate();
    assert.ok(ext.isActive);
  });

  test("commands are registered", async () => {
    const commands = await vscode.commands.getCommandList();
    assert.ok(commands.includes("weapon.setup"));
    assert.ok(commands.includes("weapon.dump_hosts"));
    assert.ok(commands.includes("weapon.switch_host"));
  });
});
```

---

## 运行测试

### 配置（`.vscode-test.mjs`）

```javascript
import { defineConfig } from "@vscode/test-cli";

export default defineConfig([
  {
    label: "unit",
    files: "out/test/unit/**/*.test.js",
    mocha: { timeout: 10000 },
  },
  {
    label: "integration",
    files: "out/test/integration/**/*.test.js",
    mocha: { timeout: 30000 },
    workspaceFolder: "./src/test/fixtures",
  },
  {
    label: "e2e",
    files: "out/test/e2e/**/*.test.js",
    mocha: { timeout: 60000 },
    workspaceFolder: "./src/test/fixtures",
  },
]);
```

### NPM 脚本

```jsonc
{
  "scripts": {
    "test": "vscode-test",
    "test:unit": "vscode-test --label unit",
    "test:integration": "vscode-test --label integration",
    "test:e2e": "vscode-test --label e2e",
    "pretest": "pnpm run compile-tests && pnpm run compile && pnpm run lint"
  }
}
```

### CI 集成

添加到 `.github/workflows/build.yml`：

```yaml
- name: Run tests
  uses: coactions/setup-xvfb@v1
  with:
    run: pnpm test
```

（VS Code 测试需要显示环境；`xvfb` 在 CI 中提供虚拟显示。）

---

## 测试固件

创建真实的测试数据：

### `src/test/fixtures/hosts/dc01.md`

```markdown
---
type: host
title: DC01
---

# DC01 - Domain Controller

```yaml host
hostname: dc01.corp.local
ip: 10.10.10.100
alias:
  - dc01
is_dc: true
is_current: true
is_current_dc: true
```

## Services
- SMB (445)
- LDAP (389)
- Kerberos (88)
```

### `src/test/fixtures/users/admin.md`

```markdown
---
type: user
title: Administrator
---

# Corp Admin

```yaml credentials
user: administrator
password: P@ssw0rd123
login: CORP\administrator
is_current: true
```
```

---

## 覆盖率目标

| 模块 | 当前 | 目标 | 优先级 |
|--------|---------|--------|----------|
| `core/domain/` | 0% | 90% | 高 |
| `core/markdown/` | 0% | 95% | 高 |
| `core/env/` | 0% | 95% | 高 |
| `features/targets/sync/` | 0% | 70% | 高 |
| `features/notes/reports/` | 0% | 80% | 中 |
| `features/http/` | 0% | 60% | 中 |
| `platform/vscode/` | 0% | 50% | 低 |
| E2E | 0% | 关键路径 | 低 |

从 `core/` 开始——它没有任何 VS Code 依赖，测试起来最为简单直接。
