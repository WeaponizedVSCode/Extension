# 工作区初始化

创建渗透测试工作区所需的目录结构、模板和配置文件。

## 命令

```
weapon management: Setup/Create/Init weaponized vscode folder in current workspace
```

命令 ID：`weapon.setup`

## 创建的目录结构

```
workspace/
├── .foam/
│   └── templates/          # Foam 笔记模板
│       ├── finding.md
│       ├── host.md
│       ├── service.md
│       └── user.md
├── .vscode/
│   ├── settings.json       # 扩展配置
│   ├── extensions.json     # 推荐扩展
│   └── .zshrc              # Shell 环境配置
├── hosts/                  # 主机定义文件
├── users/                  # 凭证定义文件
└── services/               # 服务信息文件
```

## Shell 集成

初始化命令会检查你的 Shell 配置文件（`.zshrc` / `.bashrc`）中是否包含自动加载项目环境变量的辅助函数：

```bash
weapon_vscode_launch_helper () {
  if [ -n "$PROJECT_FOLDER" ]; then
    if [ -f "$PROJECT_FOLDER/.vscode/.zshrc" ]; then
      source $PROJECT_FOLDER/.vscode/.zshrc
    fi
  fi
}
weapon_vscode_launch_helper
```

如果缺失，会提供复制按钮以便添加。

## 关键文件

- `src/features/setup/setupCommand.ts` — 创建工作区结构、检查 Shell 配置
- `src/features/setup/assets.ts` — 内置模板文件内容
