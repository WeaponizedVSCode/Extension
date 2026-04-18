# 代码片段

四个渗透测试工作流代码片段库，可在 Markdown 文件中使用。

## 使用方式

在 Markdown 文件中输入片段前缀，然后按 `Tab` 或 `Enter` 展开。

## 片段库

### Weapon 片段

常用渗透测试模板：

| 前缀 | 说明 |
|------|------|
| `find suid` | 查找具有 SUID 权限的文件 |
| `pty python` | Python PTY 控制台 |
| `psql` | PostgreSQL 登录/RCE |
| `` ```yaml credentials `` | 用户凭证 YAML 模板 |
| `` ```yaml host `` | 主机信息 YAML 模板 |
| `` ```sh `` | Shell 代码块 |

### GTFOBins 片段

来自 [GTFOBins](https://gtfobins.github.io/) 的 Linux 二进制文件提权技术。涵盖文件读取、文件写入、SUID 利用、获取 Shell 等。

### LOLBAS 片段

来自 [LOLBAS](https://lolbas-project.github.io/) 的 Windows "就地取材"二进制文件和脚本。

### BloodHound 片段

Active Directory 关系查询片段，用于 BloodHound 分析。

## 关键文件

- `src/snippets/source/weapon/weapon.json`
- `src/snippets/source/gtfobins/gtfobins.json`
- `src/snippets/source/lolbas/lolbas.json`
- `src/snippets/source/blood/blood.json`
