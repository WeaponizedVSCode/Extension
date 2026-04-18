# 终端配置文件

预配置的渗透测试工具终端启动器。

## 可用配置

从 VS Code 终端下拉菜单中选择：

### Msfconsole

启动 `msfconsole`，通过 `setg` 预配置 `LHOST` 和 `LPORT`。如有配置资源文件则自动加载。

配置 ID：`weaponized.msfconsole`

### Meterpreter Handler

以静默模式启动 `msfconsole`，预配置 Handler 以接收所选载荷类型的反向连接。

配置 ID：`weaponized.meterpreter-handler`

### Netcat Handler

启动 netcat 监听器以接收反向 Shell。默认命令：

```bash
rlwrap -I -cAr netcat -lvvp ${config:weaponized.lport}
```

配置 ID：`weaponized.netcat-handler`

### Web Delivery

启动 HTTP 服务器用于载荷分发。默认命令：

```bash
simplehttpserver -listen 0.0.0.0:${config:weaponized.listenon} -verbose -upload
```

显示 curl、wget、PowerShell 和 certutil 的下载/上传命令速查表。

配置 ID：`weaponized.web-delivery`

## 配置项

| 设置 | 说明 |
|------|------|
| `weaponized.lhost` | 本地 IP |
| `weaponized.lport` | 监听端口 |
| `weaponized.listenon` | Web Delivery 端口 |
| `weaponized.netcat` | Netcat 命令模板 |
| `weaponized.webdelivery` | Web Delivery 命令模板 |
| `weaponized.msf.console` | Msfconsole 路径 |
| `weaponized.msf.resourcefile` | MSF 资源文件路径 |

## 关键文件

- `src/features/terminal/profiles/msfprofile.ts`
- `src/features/terminal/profiles/netcatprofile.ts`
- `src/features/terminal/profiles/webprofile.ts`
- `src/features/terminal/profiles/base.ts`
