# 主机管理

解析和管理 Markdown 文件中以 YAML 块定义的目标主机。

## 使用方式

在 `hosts/` 目录下的 Markdown 文件中添加带 `host` 标识的 YAML 块：

````markdown
```yaml host
- hostname: dc01.corp.local
  ip: 192.168.1.10
  alias:
    - corp.local
  is_dc: true
  is_current: true
  is_current_dc: true
  props:
    ENV_DOMAIN: corp.local
```
````

扩展会在文件保存时自动解析这些块，构建集中化的主机列表，并导出环境变量。

## 主机字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `hostname` | string | 目标主机名 |
| `ip` | string | IP 地址 |
| `alias` | string[] | 主机别名列表 |
| `is_dc` | boolean | 是否为域控制器 |
| `is_current` | boolean | 是否为当前活动目标 |
| `is_current_dc` | boolean | 是否为当前活动域控 |
| `props` | object | 自定义属性（`ENV_` 前缀会导出为环境变量） |

## 命令

| 命令 | ID | 说明 |
|------|-----|------|
| 切换/设置当前主机 | `weapon.switch_host` | 在所有 Markdown 文件中设置活动主机 |
| 列出/导出所有主机 | `weapon.dump_hosts` | 以 env/hosts/yaml/表格 格式显示主机 |

## CodeLens 操作

主机 YAML 块上方显示以下按钮：

- **export to terminal** — 导出为环境变量
- **export as current** — 设为当前目标并导出
- **set as current** / **unset as current** — 切换 `is_current` 标志
- **Scan host** — 对该主机启动扫描

## 导出的环境变量

当 `is_current: true` 时：

```bash
export TARGET='dc01.corp.local'
export HOST='dc01.corp.local'
export DOMAIN='dc01.corp.local'
export RHOST='192.168.1.10'
export IP='192.168.1.10'
```

## 关键文件

- `src/features/targets/commands/switchHost.ts`
- `src/features/targets/commands/dumpHosts.ts`
- `src/features/targets/sync/markdownSync.ts`
- `src/features/targets/codelens/yaml/dumpProvider.ts`
