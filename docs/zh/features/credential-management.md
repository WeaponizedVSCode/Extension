# 凭证管理

管理 Markdown 文件中以 YAML 块定义的用户凭证，支持多种渗透工具格式导出。

## 使用方式

在 `users/` 目录下的 Markdown 文件中添加带 `credentials` 标识的 YAML 块：

````markdown
```yaml credentials
- user: administrator
  password: P@ssw0rd123
  login: CORP
  is_current: true
  props: {}

- user: svc_backup
  nt_hash: 5fbc3d5fec8206a30f4b6c473d68ae76
  login: CORP
  is_current: false
  props: {}
```
````

## 凭证字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `user` | string | 用户名 |
| `password` | string | 密码（与 `nt_hash` 互斥） |
| `nt_hash` | string | NTLM 哈希（与 `password` 互斥） |
| `login` | string | 登录域或上下文 |
| `is_current` | boolean | 是否为当前活动凭证 |
| `props` | object | 自定义属性 |

## 命令

| 命令 | ID | 说明 |
|------|-----|------|
| 切换/设置当前用户 | `weapon.switch_user` | 在所有文件中设置活动凭证 |
| 列出/导出所有用户 | `weapon.dump_users` | 以选定格式显示凭证 |

## 导出格式

**Impacket 格式：**
```bash
'CORP'/'administrator':'P@ssw0rd123'
'CORP'/'svc_backup' -hashes ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

**NetExec (nxc) 格式：**
```bash
'CORP' -u 'administrator' -p 'P@ssw0rd123'
'CORP' -u 'svc_backup' -H ':5fbc3d5fec8206a30f4b6c473d68ae76'
```

## CodeLens 操作

凭证 YAML 块上方显示：

- **export to terminal** / **export as current**
- **dump as impacket** / **dump as nxc**
- **set as current** / **unset as current**

## 关键文件

- `src/features/targets/commands/switchUser.ts`
- `src/features/targets/commands/dumpUsers.ts`
- `src/features/targets/codelens/yaml/dumpProvider.ts`
