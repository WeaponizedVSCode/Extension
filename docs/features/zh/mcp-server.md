# MCP 服务器

模型上下文协议（Model Context Protocol）服务器，向外部 AI 客户端暴露扩展状态。

## 概述

MCP 服务器是一个独立的 Node.js 进程，通过 stdio 通信。它从 `.weapon-state/` 目录读取扩展状态（基于文件的 IPC），并为 AI 辅助渗透测试提供工具、资源和提示模板。

## 安装

在命令面板中运行：

```
weapon mcp: Install MCP server config
```

此命令会写入 `.vscode/mcp.json` 文件指向打包的服务器。重新加载 AI 客户端即可连接。

## 工具

| 工具 | 说明 |
|------|------|
| `list_terminals` | 列出所有打开的 VS Code 终端 |
| `read_terminal` | 读取终端的最近输出（最后 N 行） |
| `send_to_terminal` | 向终端发送命令 |
| `get_targets` | 获取所有发现的主机/目标 |
| `get_credentials` | 获取所有发现的凭证 |

## 资源

| 资源 | URI | 说明 |
|------|-----|------|
| 主机列表 | `hosts://list` | 所有发现的主机 |
| 当前主机 | `hosts://current` | 当前活动目标 |
| 用户列表 | `users://list` | 所有发现的凭证 |
| 当前用户 | `users://current` | 当前活动凭证 |
| 环境变量 | `env://variables` | 导出的环境变量 |

## 提示模板

| 模板 | 说明 |
|------|------|
| `analyze-output` | 分析工具输出，含当前目标上下文 |
| `suggest-next-steps` | 建议下一步渗透操作 |

## 架构

```
Extension Host                .weapon-state/              MCP Server (Node.js)
──────────────                ──────────────              ──────────────────────
跟踪终端         ──写入──►  terminals.json       ◄──读取──  list_terminals
捕获输出         ──写入──►  terminals/{id}.log   ◄──读取──  read_terminal
监听命令         ◄──读取──  terminal-input.json  ──写入──  send_to_terminal
同步主机         ──写入──►  hosts.json           ◄──读取──  get_targets
同步用户         ──写入──►  users.json           ◄──读取──  get_credentials
```

## 兼容客户端

任何 MCP 兼容的 AI 客户端：Claude Code、Cursor、Windsurf 等。

## 关键文件

- `src/mcp/server.ts` — MCP 服务器，含资源、工具和提示
- `src/mcp/bridge.ts` — StateBridge，读取 `.weapon-state/` 文件
- `src/features/mcp/install.ts` — MCP 配置安装命令
- `webpack.config.mcp.js` — MCP 服务器独立 webpack 构建配置
