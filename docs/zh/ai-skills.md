# AI 技能

为使用 Weaponized VS Code 的 AI 助手预构建的技能。

## Pentest with Weaponized

一个全面的技能，教 AI 助手（Claude Code、Cursor 等）如何使用 Weaponized MCP 工具和工作区功能进行渗透测试。

**涵盖内容：**

- 全部 13 个 MCP 工具：目标、凭据、发现、终端、关系图
- 6 个 MCP 资源用于只读状态访问
- 4 种工作流模式：侦察、凭据利用、监听器设置、迭代攻击
- 工作区笔记结构（host YAML、credentials YAML、finding frontmatter）
- 记录发现和构建命令的最佳实践

### 下载

<a href="/Extension/pentest-with-weaponized.zip" download>下载 pentest-with-weaponized.zip</a>

### 安装方法

#### Claude Code

```bash
# 解压到项目的 .claude/skills/ 目录
unzip pentest-with-weaponized.zip -d .claude/skills/

# 或全局安装
unzip pentest-with-weaponized.zip -d ~/.claude/skills/
```

#### 其他 MCP 客户端

将 `SKILL.md` 的内容复制到你的 AI 客户端的系统提示或知识库配置中。

### 预览

::: details 查看 SKILL.md 内容
<<< ../skills/pentest-with-weaponized/SKILL.md
:::
