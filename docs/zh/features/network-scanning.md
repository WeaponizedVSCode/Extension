# 网络扫描

对发现的目标运行可配置的安全扫描器。

## 命令

```
weapon task: Run scanner over target
```

命令 ID：`weapon.task.scan`

## 交互流程

1. **选择目标主机** — 从已发现的主机列表中选择
2. **选择扫描选项** — 主机名、IP 或别名
3. **选择扫描器** — 从已配置的扫描器列表中选择

## 默认扫描器

| 扫描器 | 命令 |
|--------|------|
| rustscan | `rustscan -a $TARGET -- --script=vuln -A` |
| nuclei | `nuclei -target $TARGET` |
| dirsearch | `dirsearch -u http://$TARGET` |
| dirsearch https | `dirsearch -u https://$TARGET` |
| feroxbuster | `feroxbuster -u http://$TARGET -w ... -x php,html,txt -t 50` |
| wfuzz subdomain | `wfuzz -c -w ... -u http://$TARGET -H 'Host: FUZZ.$TARGET'` |
| ffuf subdomain | `ffuf -c -w ... -u http://$TARGET -H 'Host: FUZZ.$TARGET'` |

## 自定义扫描器

在设置中添加自定义扫描器：

```json
{
  "weaponized.scanners": {
    "nmap_full": "nmap -sS -sV -O -A -T4 --script vuln $TARGET",
    "masscan": "masscan -p1-65535 $TARGET --rate=1000"
  }
}
```

`$TARGET` 占位符会被替换为所选主机。

## 关键文件

- `src/features/tasks/commands/scan.ts`
- `src/features/targets/codelens/yaml/scanTaskProvider.ts`
