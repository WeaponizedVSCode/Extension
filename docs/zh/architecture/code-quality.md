# 代码质量

## 概述

本文档记录代码库中已知的代码质量问题，按严重程度排序。已修复的问题（Foam await、静态 Foam()、激活错误边界、let→const、状态访问器缓存、重复 is_dc）已移除。

---

## 中等严重性

### 1. `defaultCollects` 部分仍为即时求值

**文件：** `src/platform/vscode/defaultCollects.ts`

已添加 `getDefaultCollects()` 函数以延迟读取配置，但模块仍导出 `const defaultCollects = getDefaultCollects()`，在导入时即时求值。这意味着运行时的设置变更（用户编辑 `settings.json`）不会生效，直到扩展重新加载。

**修复：** 移除模块级常量，让 `ProcessWorkspaceStateToEnvironmentCollects` 直接调用 `getDefaultCollects()`。添加 `onDidChangeConfiguration` 监听器，在 `weaponized.*` 设置变更时重新运行环境变量注入。

### 2. `callback` 类型不安全

**文件：** `src/shared/types.ts`

共享的 `callback` 类型为 `(...args: any[]) => any`，绕过了 TypeScript 的类型检查。所有命令处理器都使用此类型。

**修复：** 要么移除它并为每个处理器正确定义类型，要么收紧为 `(...args: unknown[]) => unknown`。

### 3. SSL 验证全局禁用

**文件：** `src/features/http/commands/rawRequest.ts`

对于 HTTPS 请求，代码设置了 `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'`（进程级副作用）和 agent 上的 `rejectUnauthorized: false`。这对于渗透测试目标的自签名证书是有意为之的，但是：
- 环境变量泄漏到整个 Node 进程，而非仅此请求
- 没有向用户显示警告

**修复：** 移除环境变量修改。每个 agent 的 `rejectUnauthorized: false` 已足够。可选地在响应输出中添加可视指示。

### 4. ~~Foam 访问中的错误处理不一致~~ （已解决）

**文件：** `src/platform/vscode/context.ts`

**状态：** 已修复。`Context.Foam()` 现在将激活 + 导出读取序列包装在 try/catch 中，失败时返回 `undefined`。

---

## 低严重性 / 风格

### 5. 缺少 `.editorconfig`

项目根目录没有 `.editorconfig`。添加一个可确保跨编辑器的一致格式化（2 空格缩进、LF 换行、UTF-8、去除尾部空白）。

### 6. 代码生成依赖 Python

`scripts/gen-setup.py` 和 `scripts/gen-report-assets.py` 仅用于 base64 编码文件并生成 TypeScript。它们可以改写为 TypeScript 脚本（通过 `tsx`）以消除 Python 3 前置依赖。

### 7. ESLint 配置

建议启用以下规则：

- `@typescript-eslint/no-floating-promises`：捕获缺失的 await
- `@typescript-eslint/no-explicit-any`：标记 `any` 使用
- `no-console`：引导使用 logger

---

## 建议修复优先级

| 优先级 | 问题 | 工作量 | 影响 |
|--------|------|--------|------|
| 1 | defaultCollects 即时求值 (#1) | 30 分钟 | 设置热重载 |
| 2 | ~~Foam 错误处理 (#4)~~ | ~~15 分钟~~ | ~~可靠性~~ （已修复） |
| 3 | SSL 全局副作用 (#3) | 10 分钟 | 安全卫生 |
| 4 | callback 类型 (#2) | 30 分钟 | 类型安全 |
| 5 | ESLint 规则 (#7) | 30 分钟 | 长期质量 |
| 6 | .editorconfig (#5) | 5 分钟 | 一致性 |
| 7 | Python → TS 代码生成 (#6) | 1 小时 | 减少前置依赖 |
