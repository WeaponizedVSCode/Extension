# 密码破解

交互式 Hashcat 集成，用于哈希破解。

## 命令

```
weapon task: Crack hashes with hashcat
```

命令 ID：`weapon.task.hashcat_cracker`

## 交互流程

1. **选择哈希文件** — 通过文件选择器浏览选择
2. **选择攻击模式**：字典攻击 (0)、组合攻击 (1)、暴力破解 (3)、规则攻击 (6)
3. **选择哈希类型**：MD5、SHA1、SHA256、NTLM、NetNTLMv2、Kerberos TGS/AS-REP 等
4. **选择设备**：CPU 或 GPU
5. **指定字典文件**：默认 `$ROCKYOU`

## 配置

| 设置 | 说明 |
|------|------|
| `weaponized.hashcat` | Hashcat 可执行文件路径 |

## 关键文件

- `src/features/tasks/commands/hashcat.ts`
- `src/features/tasks/ui/filePicker.ts`
