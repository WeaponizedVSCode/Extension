# 功能路线图

## 当前状态 (v0.0.1)

该扩展已经提供了坚实的基础：
- 基于 Markdown 的目标/凭据管理，使用 YAML 代码块
- 向所有终端导出环境变量
- 针对 Shell 命令、HTTP 请求、YAML 代码块的 CodeLens 支持
- msfvenom、hashcat、扫描器集成
- 终端配置文件（msfconsole、meterpreter、netcat、web delivery）
- 终端录制器（命令/输出日志记录）
- Foam 集成，支持知识图谱 + Tarjan 强连通分量报告生成
- 代码片段：BloodHound、GTFOBins、LOLBAS
- CyberChef 解码器集成

---

## 第一阶段：基础加固 (v0.1.0)

**目标：** 修复 Bug，添加测试，为 AI 集成做准备。

### 1.1 代码质量修复
- [x] 修复 Foam 激活时缺少的 `await`
- [x] 将 `Foam()` 改为静态方法
- [x] 在激活过程中添加错误边界
- [x] 全面将 `let` 转换为 `const`
- [x] 修复重复的 `is_dc` 赋值
- [x] 状态访问器缓存
- [x] `defaultCollects` 惰性加载
- [ ] 启用严格的 TSConfig 选项

### 1.2 测试
- [x] 搭建测试基础设施和测试夹具
- [x] `core/domain/` 的单元测试（Host、UserCredential）
- [x] `core/markdown/` 的单元测试（fencedBlocks、yamlBlocks）
- [x] `core/env/` 的单元测试（collects、envVarSafer、mergeCollects）
- [ ] 目标同步的集成测试
- [ ] 端到端激活测试
- [ ] CI 测试流水线

### 1.3 开发者体验
- [x] 为 AI 编程助手添加 `AGENTS.md`
- [ ] 添加 `.editorconfig`
- [ ] 将 Python 生成器重写为 TypeScript
- [ ] 在 README 中记录所有环境变量

---

## 第二阶段：AI 集成 (v0.2.0)

**目标：** 添加 AI 助手和外部 AI 控制。

### 2.1 Copilot 聊天参与者
- [x] 注册 `@weapon` 聊天参与者
- [x] 实现 `/analyze` 命令（分析工具输出）
- [x] 实现 `/suggest` 命令（建议下一步操作）
- [x] 实现 `/generate` 命令（生成命令）
- [x] 实现 `/report` 命令（评估摘要）
- [x] 实现 `/explain` 命令（解释概念）
- [x] 构建包含评估上下文的系统提示
- [x] 在所有 LLM 上下文中添加凭据脱敏
- [ ] 添加内联操作按钮（运行命令、创建笔记）

### 2.2 MCP 服务器
- [x] 实现嵌入式 MCP 服务器，使用 Streamable HTTP 传输
- [ ] 资源：hosts、users、env-vars、terminal-logs、notes
- [x] 只读工具：get_targets、get_credentials、get_graph、list_findings、get_finding
- [x] 写入工具：create_finding、update_finding_frontmatter
- [x] 格式化输出工具：get_hosts_formatted、get_credentials_formatted
- [x] 终端工具：list_terminals、read_terminal、send_to_terminal、create_terminal
- [ ] 尚未实现：search_notes、get_attack_graph、switch_target、switch_user、run_command、run_scanner、generate_report、decode_text
- [ ] 提示模板：analyze-output、suggest-next-steps、privesc-check
- [ ] MCP Inspector 测试
- [ ] Claude Code、Cursor、VS Code MCP 配置的文档

### 2.3 AI 安全
- [ ] 在所有面向 AI 的接口中进行凭据脱敏
- [ ] AI 发起执行的命令验证
- [ ] AI 操作审计日志
- [ ] `weaponized.ai.redactCredentials` 设置
- [ ] 带用户审批的 MCP 写入工具命令队列

---

## 第三阶段：增强工作流 (v0.3.0)

**目标：** 智能自动化和数据导入。

### 3.1 自动导入扫描结果
- [ ] 文件监视器，监视 `*.xml`（nmap XML 输出）
- [ ] Nmap XML 解析器 → 自动创建主机/服务笔记
- [ ] 文件监视器，监视 `*.json`（各种工具输出）
- [ ] 导入向导：显示预览，让用户在创建笔记前确认
- [ ] 支持格式：nmap、masscan、nuclei JSON、feroxbuster JSON

### 3.2 智能命令建议
- [ ] 上下文感知的命令面板：基于当前主机操作系统、服务
- [ ] "下一步尝试什么"侧边栏面板
- [ ] 带成功/失败跟踪的命令历史
- [ ] 与终端录制器集成：解析输出 → 建议后续操作

### 3.3 凭据保险库
- [ ] 在 `workspaceState` 中对静态凭据进行加密
- [ ] 打开工作区时要求主密码（或钥匙串集成）
- [ ] 凭据轮换跟踪（这个密码是什么时候获取的？）
- [ ] `weaponized.vault.enabled` 设置

### 3.4 多评估支持
- [ ] 评估配置文件（每个评估有不同的状态）
- [ ] 快速切换评估
- [ ] 评估归档（将所有笔记 + 状态导出为 ZIP）

---

## 第四阶段：可视化与报告 (v0.4.0)

**目标：** 丰富的可视化分析工具。

### 4.1 攻击图 Webview
- [ ] 攻击图的交互式 webview 面板（不仅仅是 Markdown 中的 Mermaid）
- [ ] 可点击节点 → 打开对应的 Foam 笔记
- [ ] 按节点类型着色（主机、用户、服务、发现）
- [ ] 按严重程度、主机、技术进行过滤

### 4.2 时间线视图
- [ ] Webview 面板，按时间顺序显示以下内容的时间线：
  - 执行的终端命令
  - 发现的主机
  - 获取的凭据
  - 记录的发现
- [ ] 可按主机、用户、时间范围过滤
- [ ] 导出为 Markdown 作为报告附录

### 4.3 报告模板
- [ ] 多种报告格式：Markdown、HTML、PDF（通过 pandoc）
- [ ] 执行摘要模板
- [ ] 技术发现模板（每个发现：描述、证据、修复建议）
- [ ] CVSS 评分集成
- [ ] 报告差异：比较两个评估快照

### 4.4 仪表盘
- [ ] 状态栏项目：当前主机、当前用户、发现数量
- [ ] 树视图：评估概览（主机 → 服务 → 发现）
- [ ] 快速统计：已控制主机、已攻破用户、按严重程度分类的发现

---

## 第五阶段：协作与生态系统 (v0.5.0)

**目标：** 团队功能和工具生态系统。

### 5.1 团队协作
- [ ] 通过 Git 共享评估状态（已经是基于 Markdown 的！）
- [ ] 同时编辑的冲突解决
- [ ] 活动动态：其他团队成员发现了什么？
- [ ] 共享终端日志聚合

### 5.2 工具生态系统
- [ ] 自定义工具集成的插件 API
- [ ] 社区代码片段包（不仅限于 BloodHound/GTFOBins/LOLBAS）
- [ ] 自定义扫描器定义（不仅限于 `weaponized.scanners` 配置）
- [ ] 集成：
  - Burp Suite（导入/导出）
  - BloodHound CE（直接 API）
  - Cobalt Strike（团队服务器监听器状态）
  - Sliver C2
  - Havoc C2

### 5.3 AI 增强
- [ ] 本地 LLM 支持（ollama），用于离线评估
- [ ] AI 驱动的发现去重
- [ ] 每个发现的自动修复建议
- [ ] AI 报告撰写助手（草稿 → 审核 → 定稿）
- [ ] 当 API 稳定后使用 VS Code `vscode.lm.registerTool()`（替代独立 MCP）

---

## 功能优先级矩阵

| 功能 | 用户价值 | 工作量 | 依赖项 | 阶段 |
|---------|-----------|--------|-------------|-------|
| 代码质量修复 | 中 | 低 | 无 | 1 |
| core/ 的单元测试 | 高 | 低 | 无 | 1 |
| Copilot 聊天参与者 | 高 | 中 | 无 | 2 |
| MCP 服务器（只读） | 高 | 中 | 无 | 2 |
| MCP 服务器（工具） | 高 | 中 | MCP 只读 | 2 |
| Nmap XML 自动导入 | 高 | 中 | 无 | 3 |
| 凭据保险库 | 高 | 中 | 无 | 3 |
| 攻击图 webview | 中 | 高 | 报告生成器 | 4 |
| 时间线视图 | 中 | 高 | 终端录制器 | 4 |
| 本地 LLM 支持 | 中 | 高 | AI 服务层 | 5 |
| 团队协作 | 中 | 高 | Git 工作流 | 5 |
| 工具生态系统插件 | 低 | 非常高 | 插件 API 设计 | 5 |

---

## 非目标

以下内容明确不在范围内：

- **构建 C2 框架** — 使用现有的（Sliver、Cobalt Strike）
- **替代 Burp Suite** — 专注于终端/笔记工作流
- **基于 Web 的 UI** — 这是一个 VS Code 扩展，不是 Web 应用
- **自动化漏洞利用** — AI 辅助，人类决策和执行
- **支持非 VS Code 编辑器** — MCP 服务器支持 AI 工具集成，但核心体验在 VS Code 中

---

## 成功指标

| 指标 | 当前值 | 第一阶段目标 | 第二阶段目标 |
|--------|---------|----------------|----------------|
| 测试覆盖率 (core/) | ~90% | 90% | 90% |
| 测试覆盖率（总体） | 0% | 40% | 60% |
| 已知 Bug | ~5 | 0 | 0 |
| 可用 AI 命令 | 5 | 0 | 5+ |
| 可用 MCP 工具 | 13 | 0 | 10+ |
| 扫描结果自动导入 | 0 种格式 | 0 | 0 |
| 支持的扫描器配置 | 9 | 9 | 12+ |
