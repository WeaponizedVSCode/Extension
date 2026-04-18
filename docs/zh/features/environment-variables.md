# 环境变量

自动管理终端环境变量，使终端会话与工作区状态保持同步。

## 工作原理

当 Markdown 文件中的主机和凭证被修改时，扩展会：

1. 解析 YAML 块并更新工作区状态
2. 将当前目标信息写入 `.vscode/.zshrc`
3. 新终端自动加载这些变量

## 内置变量

### 主机变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `$TARGET` | 当前主机 | 目标主机名 |
| `$HOST` | 当前主机 | 主机名（同 TARGET） |
| `$DOMAIN` | 当前主机 | 域名 |
| `$RHOST` | 当前主机 | 目标 IP 地址 |
| `$IP` | 当前主机 | IP 地址（同 RHOST） |
| `$DC_HOST` | 当前域控 | 域控制器主机名 |
| `$DC_IP` | 当前域控 | 域控制器 IP |

### 凭证变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `$USER` | 当前用户 | 用户名 |
| `$USERNAME` | 当前用户 | 用户名（同 USER） |
| `$PASS` | 当前用户 | 密码 |
| `$PASSWORD` | 当前用户 | 密码（同 PASS） |
| `$NT_HASH` | 当前用户 | NTLM 哈希 |
| `$LOGIN` | 当前用户 | 登录域 |

### 配置变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `$LHOST` | 配置 | 本地监听 IP |
| `$LPORT` | 配置 | 本地监听端口 |

## 自定义变量

通过主机/用户 `props` 字段添加 `ENV_` 前缀的自定义环境变量：

```yaml host
- hostname: target.htb
  ip: 10.10.10.100
  props:
    ENV_WEB_PORT: "8080"
```

导出为：`export WEB_PORT='8080'`

也可通过设置添加：

```json
{
  "weaponized.envs": {
    "WORDLIST_DIR": "/usr/share/wordlists"
  }
}
```

## Shell 辅助函数

`.vscode/.zshrc` 还提供以下工具函数：

```bash
current_status          # 查看当前目标状态
url encode "string"     # URL 编码
url decode "string"     # URL 解码
ntlm "password"         # 生成 NTLM 哈希
proxys on|off|show      # 代理切换
```

## 关键文件

- `src/features/targets/sync/markdownSync.ts` — 解析和导出变量
- `src/features/targets/sync/index.ts` — 同步入口
- `src/features/targets/sync/graphBuilder.ts` — 构建目标图
