# 测试策略

## 当前状态

项目有 7 个单元测试文件，覆盖 `core/` 层的领域逻辑和 Markdown 解析。测试使用 **Mocha**（`suite`/`test`）配合 **Node.js `assert`**。测试基础设施使用 `@vscode/test-cli` 和 `@vscode/test-electron`。

```
src/test/unit/
  core/
    domain/
      host.test.ts          — Host 模型：初始化、默认值、环境变量导出、导出格式
      user.test.ts          — UserCredential 模型：初始化、环境变量导出、导出格式
      finding.test.ts       — 从 Markdown frontmatter 解析 Finding
      graph.test.ts         — 关系图 + Tarjan SCC
    env/
      collects.test.ts      — mergeCollects 优先级行为
    markdown/
      fencedBlocks.test.ts  — 围栏代码块提取
      yamlBlocks.test.ts    — 按标识关键字提取 YAML 块
```

---

## 运行测试

```bash
pnpm run compile-tests    # 通过 tsc 编译到 out/
pnpm run test:unit        # 运行单元测试
```

在 CI 中，Linux 需使用 `xvfb-run` 进行无头 VS Code 测试执行。

---

## 测试金字塔

| 层级 | 测试内容 | 方式 | 目标覆盖率 |
|------|---------|------|-----------|
| `core/` | 领域模型、解析、图算法 | 纯单元测试，无需 mock | 90%+ |
| `platform/vscode/` | Context 缓存、变量解析、环境变量集合 | Mock `workspaceState` 和 `vscode.workspace` | 60%+ |
| `features/` | 命令处理器、同步逻辑、MCP 工具处理器 | Mock Context + VS Code API | 70%+ |
| E2E | 激活、文件同步、完整命令工作流 | `@vscode/test-electron` + 测试工作区 | 关键路径 |

---

## 已覆盖内容

现有单元测试集中在 `core/` 层：

- **Host/User 模型**：完整/最小/缺失数据的初始化、默认值、环境变量导出（`exportEnvironmentCollects`）、导出格式输出（env、hosts 文件、yaml、table、impacket、nxc）
- **Finding**：从 Markdown 解析 frontmatter 字段（severity、tags、description）
- **Graph**：从 Foam 资源构建节点/边、Tarjan SCC 计算、最长路径计算
- **Collects**：`mergeCollects` 先写入者优先行为、优先级排序
- **Markdown 解析**：围栏代码块提取（含/不含语言标签）、按标识关键字提取 YAML 块

---

## 差距

| 区域 | 差距 | 难度 |
|------|------|------|
| `platform/vscode/context.ts` | 脏标记缓存、Foam() 生命周期 | 中等 — 需要 `workspaceState` mock |
| `platform/vscode/variables.ts` | 变量解析（`${env:X}`、`${config:X}`） | 简单 — 纯字符串处理 |
| `features/targets/sync` | 文件监听器 → 状态重建流水线 | 中等 — 需要文件系统 + Context mock |
| `features/mcp/httpServer.ts` | MCP 工具处理器返回正确数据 | 中等 — 需要 Context mock |
| `features/ai/participant.ts` | 提示词构建、命令路由 | 简单 — mock `vscode.lm` |
| `features/http/rawRequest.ts` | HTTP 请求执行 | 困难 — 需要 HTTP mock |

---

## 编写测试

使用 Mocha `suite`/`test` 配合 Node.js `assert`。在 `src/test/unit/` 下镜像源代码目录结构：

```
源文件：src/core/domain/host.ts
测试：  src/test/unit/core/domain/host.test.ts
```

现有测试中使用的关键模式：
- `suite("ClassName")` 分组相关测试
- `test("method() with scenario")` 名称描述输入条件
- `assert.equal` / `assert.deepEqual` / `assert.ok` 用于断言
- 直接实例化 — 无 DI 框架，直接 `new Host().init({...})`
- 无外部测试 fixture — 测试数据内联在每个测试文件中
