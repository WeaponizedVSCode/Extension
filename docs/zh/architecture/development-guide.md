# 开发指南

## 前置条件

- **Node.js** >= 23.11.0
- **pnpm** >= 10
- **VS Code** >= 1.101.0
- **Python 3**（用于 `gen-setup.py` 和 `gen-report-assets.py` 代码生成器）
- **Foam 扩展**（`foam.foam-vscode`）已安装在 VS Code 中

## 快速开始

```bash
# 克隆并安装
git clone https://github.com/WeaponizedVSCode/Extension.git
cd Extension
pnpm install

# 构建
pnpm run compile

# 运行测试
pnpm run compile-tests
pnpm run test:unit

# 调试模式启动
# 在 VS Code 中按 F5（使用 .vscode/launch.json）
```

---

## 构建系统

### Webpack

扩展通过 webpack 打包为单个 `dist/extension.js` 文件。

| 脚本 | 命令 | 用途 |
|------|------|------|
| `compile` | `webpack` | 开发构建 |
| `watch` | `webpack --watch` | 监听模式 |
| `package` | `webpack --mode production` | 生产构建 |

**Webpack 配置**（`webpack.config.js`）：
- Target: `node`
- 入口: `./src/extension.ts`
- 输出: `dist/extension.js`（`commonjs2`）
- 外部模块: `vscode`（由扩展宿主提供）
- Loader: `ts-loader`

### TypeScript

**`tsconfig.json`**：
- Module: `Node16`，Target: `ES2022`
- 严格模式开启
- Types: `node`、`mocha`

测试通过 `compile-tests` → `tsc -p . --outDir out` 单独编译。

### 代码生成

两个 Python 脚本在 `pnpm install` 时运行（通过 `prepare` 钩子）：
- `scripts/gen-setup.py` — 生成工作区模板 TypeScript
- `scripts/gen-report-assets.py` — 生成报告资源 TypeScript

---

## 编码规范

### 命名

| 类别 | 规范 | 示例 |
|------|------|------|
| 变量、函数、参数 | `camelCase` | `currentHost`、`parseHostsYaml()` |
| 类 | `PascalCase` | `Host`、`EmbeddedMcpServer`、`TerminalBridge` |
| 接口 & 类型别名 | `PascalCase` | `Finding`、`GraphNode`、`Collects` |
| 常量 | `SCREAMING_SNAKE_CASE` | `DEFAULT_MCP_PORT`、`MAX_OUTPUT_BYTES` |
| 命令 ID | `dot.separated_lowercase` | `weapon.dump_hosts`、`weapon.switch_host` |
| 配置项 | `dotted.camelCase` | `weaponized.ai.enabled`、`weaponized.mcp.port` |

### 类型 vs 接口

- **接口（interface）**：用于领域实体和可能被实现的形状 — `Finding`、`GraphNode`、`Foam`、`TerminalInfo`
- **类型别名（type）**：用于联合类型、函数签名和简单映射类型 — `HostDumpFormat`、`Collects`、`FencedBlock`

### 命令处理器

所有命令处理器遵循此模式：

```typescript
// features/<name>/commands/<action>.ts
import { callback } from "../../../shared/types";

export const myCommand: callback = async (args) => {
  // args 是一个具有已知属性的对象
  const { someParam } = args;
  // ...
};
```

在 `registerCommands.ts` 中注册：

```typescript
context.subscriptions.push(
  vscode.commands.registerCommand("weapon.my_command", myCommand)
);
```

### 功能注册

每个功能暴露一个注册函数：

```typescript
// features/<name>/index.ts
export function registerMyFeature(context: vscode.ExtensionContext) {
  // 注册命令、提供者、监听器
  context.subscriptions.push(/* ... */);
}
```

在 `activate.ts` 中的 try/catch 块内调用。

### 错误处理

- **激活层级**：每个 `register*()` 包裹在 try/catch 中，使用 `logger.error()`
- **命令层级**：使用 `vscode.window.showErrorMessage()` 展示用户可见的错误
- **MCP 服务器**：try/catch 在失败时返回 HTTP 500
- 不使用自定义异常类 — 使用标准 `Error`

### 状态访问

共享状态始终通过 `Context` 访问：

```typescript
import { Context } from "../../platform/vscode/context";

// 读取
const hosts = Context.HostState;
const users = Context.UserState;
const foam = await Context.Foam();

// 写入
Context.HostState = updatedHosts;
```

禁止从功能代码中直接访问 `workspaceState`。

---

## 添加新功能

### 1. 创建功能目录

```
src/features/my-feature/
  index.ts              # 注册函数
  commands/
    doSomething.ts      # 命令处理器
  codelens/             # （如适用）
    register.ts
    myProvider.ts
```

### 2. 实现命令处理器

```typescript
// src/features/my-feature/commands/doSomething.ts
import { callback } from "../../../shared/types";
import { Context } from "../../../platform/vscode/context";
import * as vscode from "vscode";

export const doSomething: callback = async () => {
  const hosts = Context.HostState;
  if (!hosts) {
    vscode.window.showWarningMessage("No hosts found.");
    return;
  }
  // 功能逻辑...
};
```

### 3. 在 index.ts 中注册

```typescript
// src/features/my-feature/index.ts
import * as vscode from "vscode";
import { doSomething } from "./commands/doSomething";

export function registerMyFeature(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("weapon.my_feature", doSomething)
  );
}
```

### 4. 接入激活流程

```typescript
// src/app/activate.ts
import { registerMyFeature } from "../features/my-feature";

// 在 activateExtension() 中：
try {
  registerMyFeature(context);
} catch (e) {
  logger.error("Failed to register my feature:", e);
}
```

### 5. 在 package.json 中添加命令

```jsonc
{
  "contributes": {
    "commands": [
      {
        "command": "weapon.my_feature",
        "title": "My Feature Action",
        "category": "weapon feature"
      }
    ]
  }
}
```

---

## 添加领域逻辑

领域逻辑属于 `core/` — **禁止在此导入 `vscode`**。

```typescript
// src/core/domain/myModel.ts
import type { Collects } from "../env/collects";

export interface MyModel {
  name: string;
  value: number;
}

export function parseMyModel(yaml: string): MyModel[] {
  // 纯解析逻辑，无 VS Code 依赖
}
```

从 `core/domain/index.ts` 和 `core/index.ts` 重导出。

---

## 添加 MCP 工具

在 `src/features/mcp/httpServer.ts` 的 `EmbeddedMcpServer.registerTools()` 中添加：

```typescript
server.tool(
  "my_tool",
  "Description of what this tool does",
  {
    param: z.string().describe("Parameter description"),
  },
  async ({ param }) => {
    // 使用 Context、TerminalBridge 等实现
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);
```

---

## 测试

### 结构

测试位于 `src/test/unit/`，镜像 `core/` 的目录结构：

```
src/test/unit/
  core/
    domain/
      host.test.ts
      user.test.ts
      finding.test.ts
      graph.test.ts
    env/
      collects.test.ts
    markdown/
      fencedBlocks.test.ts
      yamlBlocks.test.ts
```

### 编写测试

使用 Mocha 的 `suite`/`test` 和 Node.js 的 `assert`：

```typescript
import { strict as assert } from "assert";
import { Host } from "../../../core/domain/host";

suite("Host", () => {
  test("init() with full data", () => {
    const host = new Host().init({
      hostname: "dc01.corp.local",
      ip: "10.10.10.100",
      is_dc: true,
    });
    assert.equal(host.hostname, "dc01.corp.local");
    assert.equal(host.is_dc, true);
  });
});
```

### 运行测试

```bash
pnpm run compile-tests    # 编译测试到 out/
pnpm run test:unit        # 运行单元测试（Linux 需要 Xvfb）
```

在 CI 中，使用 `xvfb-run` 进行无头 VS Code 测试执行。

---

## 配置

所有配置项位于 `weaponized.*` 命名空间下。读取方式：

```typescript
const config = vscode.workspace.getConfiguration("weaponized");
const port = config.get<number>("mcp.port", 25789);
const aiEnabled = config.get<boolean>("ai.enabled", true);
```

要添加新配置项，在 `package.json` 的 `contributes.configuration.properties` 中添加。

---

## Git 工作流

- **`master`**：稳定分支，推送时触发 CI + 文档部署
- **功能分支**：在主题分支上开发，通过 PR 合并
- **提交信息格式**：`type(scope): description`
  - 类型：`feat`、`fix`、`refactor`、`docs`、`ci`、`test`、`chore`
  - 范围：功能名称或通用区域
  - 示例：`feat(mcp): add create_terminal tool`、`fix: CI build chain`
- **标签**：触发发布构建（`.github/workflows/build.yml`）

---

## 代码检查

```bash
pnpm run lint     # ESLint 检查 src/
```

ESLint 配置在 `eslint.config.mjs` 中。主要规则：`prefer-const`、TypeScript 严格检查。
