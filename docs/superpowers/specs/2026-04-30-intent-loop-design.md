# Intent Loop — AI 辅助渗透闭环系统设计

**Date:** 2026-04-30
**Status:** Approved
**Scope:** 新增 Intent 系统（数据模型 + workspaceState 队列 + MCP 工具 + TreeView UI + Skill 更新）

---

## 背景与目标

Weaponized VS Code 的核心使命是把 VS Code 变成一个渗透测试 IDE，Markdown 即数据库，AI 辅助但人类决策，终端是执行引擎。

现有系统已具备：
- Finding（Fact）：发现的漏洞/事实，存 Markdown
- EngagementSummary：全量状态聚合（Findings + Hosts + Users + Graph）
- MCP 工具：AI 可读写 Finding、操控终端

**缺失的是大脑循环**：AI 基于当前状态推理 → 生成行动计划 → 人类审批 → 执行 → 结果回流驱动下一轮推理。

本设计参考 Cairn AI 的黑板架构（Reason → Intent → Explore → Fact），在 Weaponized 现有架构上实现人机协作的半自动渗透闭环。

---

## 核心映射关系

```
Cairn AI:    Fact    →  Reason  →  Intent   →  Explore
Weaponized:  Finding    AI 分析    Intent 队列  execute_intent
```

**Finding ≈ Fact**：已确认的事实，永久持久化为 Markdown
**Intent ≈ Intent**：工作记忆，存 workspaceState，执行后消耗

---

## 架构决策

### ADR-7：Intent 存 workspaceState，不写 Markdown

**决策：** Intent 全生命周期存 `workspaceState`，不生成 Markdown 文件。

**理由：**
- Intent 是工作记忆（思考过程），Finding 是结论（知识沉淀）
- workspaceState 已跨 VS Code 重启持久化，满足实际需要
- 避免 `intents/` 目录污染工作区，不需要 git commit 攻击思路噪音
- Finding 域与 Intent 域完全解耦：Finding 不知道 Intent 存在

### ADR-8：Finding 不耦合 Intent

**决策：** `create_finding` 不加 `intent_id` 参数，保持 Finding 纯粹。

**理由：** Finding 记录"发现了什么"，不记录"如何发现的"。关联关系由 Intent 单向持有（`finding_id` 字段），不反向污染 Finding 域。

### ADR-9：execute_intent 封装 send+read+状态更新

**决策：** 新增 `execute_intent` 工具，内部串联 `send_to_terminal` + `read_terminal` + `update_intent_status`。

**理由：** MCP 工具以精为准，减少 AI 的推理链长度。AI 不需要手动协调三步操作，一个调用完成执行闭环。

---

## 数据模型

### `Intent`（`src/core/domain/intent.ts`）

```typescript
export type IntentStatus =
  | "pending"     // AI 创建，等待人类审批
  | "approved"    // 人类已审批，待执行
  | "running"     // 正在执行中
  | "completed"   // 执行完成，有输出
  | "dismissed"   // 假设被否定
  | "elevated";   // 已升级为 Finding

export interface Intent {
  id: string;               // 唯一 ID（`intent-${Date.now()}`）
  hypothesis: string;       // "DC01 存在 Kerberoastable 账号"
  reasoning: string;        // 基于哪些 Finding/状态推理出此假设
  command: string;          // 具体执行命令
  expected_outcome: string; // 什么输出可以确认假设
  status: IntentStatus;
  terminal_id?: string;     // 指定终端（不指定则用默认终端）
  output?: string;          // execute_intent 后捕获的终端输出
  finding_id?: string;      // update_intent_status elevated 时关联
  dismissed_reason?: string;// dismissed 时的原因
  created_at: string;       // ISO 时间戳
  updated_at: string;
}

export interface Goal {
  description: string;   // "获取 corp.local 的 domain admin"
  phase?: string;        // "reconnaissance" | "exploitation" | "post-exploitation"
  constraints?: string;  // "避免嘈杂扫描，不做持久化"
  updated_at: string;
}
```

### 状态流转

```
pending ──► approved ──► running ──► completed ──► elevated
   │                                     │
   └──────────────────────────────────► dismissed
```

---

## workspaceState 键名

| 键 | 类型 | 说明 |
|----|------|------|
| `weaponized.intentQueue` | `Intent[]` | 全部 Intent，按 created_at 排序 |
| `weaponized.goal` | `Goal \| null` | 当前渗透目标 |

---

## 新增模块结构

```
src/
  core/domain/
    intent.ts               ← Intent / Goal 类型（零 vscode 依赖）

  features/intent/
    queue/
      intentQueue.ts        ← workspaceState CRUD（IntentQueue 类）
    treeview/
      intentTreeProvider.ts ← VS Code TreeView Provider
      register.ts           ← 注册 TreeView
    commands/
      approveIntent.ts      ← weapon.intent.approve
      skipIntent.ts         ← weapon.intent.skip
    index.ts                ← barrel 导出 + registerIntentFeature()
```

---

## 新增 MCP 工具（5 个）

### `set_goal`
```
参数: description (string), phase? (string), constraints? (string)
行为: 写入 workspaceState.weaponized.goal
用途: 开始 engagement 或切换攻击阶段
```

### `get_goal`
```
参数: 无
行为: 读取 workspaceState.weaponized.goal
用途: Reason 步骤前获取当前目标
```

### `create_intent`
```
参数:
  hypothesis      (string, required) — 假设陈述
  reasoning       (string, required) — 推理依据（必须引用具体 Finding ID 或状态）
  command         (string, required) — 完整可执行命令
  expected_outcome(string, required) — 确认假设的输出特征
  terminal_id?    (string)           — 指定终端

行为: 生成 Intent（status: "pending"），追加到队列
约束: reasoning 必须非空且具体，不允许泛泛而谈
```

### `list_intents`
```
参数: status? (pending|approved|running|completed|dismissed|elevated)
行为: 读取队列，按状态过滤
用途: 确认哪些 Intent 已 approved，准备执行
```

### `update_intent_status`
```
参数:
  id              (string, required)
  status          (IntentStatus, required)
  dismissed_reason?(string) — status=dismissed 时必填
  finding_id?     (string)  — status=elevated 时传入

行为: 更新 Intent 状态和相关字段，写回 workspaceState
```

### `execute_intent`
```
参数: id (string)
前置条件: Intent.status === "approved"
行为:
  1. status → "running"
  2. send_to_terminal(terminal_id ?? default, command)
  3. 等待 2s（Shell Integration 缓冲）
  4. read_terminal(terminal_id) → output
  5. Intent.output = output, status → "completed"
  6. 返回 { id, command, output }

用途: 替代手动 send_to_terminal + read_terminal + update 三步串联
```

---

## 增强现有工具（1 个）

### `get_engagement_summary`（加参数）
```
新增参数: include_intents? (boolean, default: false)

当 include_intents=true 时，返回额外字段:
  goal: Goal | null
  intents: Intent[]
  intentStats: {
    pending: number,
    approved: number,
    running: number,
    completed: number,
    dismissed: number,
    elevated: number
  }
```

---

## TreeView UI

VS Code 侧边栏 TreeView，展示当前 Goal 和 Intent 队列：

```
WEAPON INTENTS
─────────────────────────────
  目标: 获取 corp.local domain admin [编辑]
  阶段: exploitation

  ▼ Pending (2)
      [●] Kerberoast DC01            [✓ Approve] [✗ Skip]
           hypothesis: DC01 存在 SPNs
      [●] SMB relay via NTLM         [✓ Approve] [✗ Skip]

  ▼ Approved (1)
      [►] SQLi dump users table      [▶ Execute]

  ▼ Running (1)
      [⟳] Enum SMB shares...

  ▼ Completed (3)  ▸ (折叠)
  ▼ Dismissed (1)  ▸ (折叠)
```

**命令：**
- `weapon.intent.approve` — 审批选中 Intent（pending → approved）
- `weapon.intent.skip` — 跳过选中 Intent（pending → dismissed）

---

## Skill 更新（`docs/skills/pentest-with-weaponized/SKILL.md`）

### 新增工具表节

```markdown
### Goal & Intent（半自动渗透闭环）

| 工具 | 用途 | 何时使用 |
|------|------|---------|
| set_goal | 设置渗透目标和阶段约束 | engagement 开始或切换阶段 |
| get_goal | 读取当前目标 | 每轮 Reason 前 |
| create_intent | 写入带推理的行动意图 | 每轮推理后批量创建 |
| list_intents | 列出意图队列（可按状态过滤） | 确认哪些已 approved |
| update_intent_status | 更新意图状态（dismiss/elevate） | 假设被否定时 |
| execute_intent | 执行已审批意图（自动读取输出） | 有 approved Intent 时 |
```

### 新增 Pattern 5：Intent Loop

```markdown
### Pattern 5: AI-Driven Intent Loop（半自动渗透闭环）

**完整循环：**

1. get_goal
   → 确认当前渗透目标和阶段约束

2. get_engagement_summary(include_intents=true)
   → 一次调用获取全量上下文
   → 分析: Findings + Hosts + Users + Graph + 现有 Intents

3. create_intent × N（批量，不要单条）
   → 本轮推理生成的所有行动意图
   → reasoning 必须引用具体 Finding ID 或状态

4. [等待人类在 TreeView 审批]
   → list_intents(status="approved") 确认

5. execute_intent(id)
   → 自动执行 + 读取输出（无需手动 send+read）

6. 分析 output:
   ├─ 假设确认 → create_finding(...) + update_intent_status(id, "elevated", finding_id=...)
   └─ 假设否定 → update_intent_status(id, "dismissed", dismissed_reason="...")

7. 回到步骤 2（循环，直到 Goal 达成或用户叫停）
```

### 新增 Intent 使用规则

```markdown
## Intent 使用规则

**批量创建，不要单条**
每轮 Reason 后一次性 create_intent 多条，让人类看到完整攻击思路。

**reasoning 必须引用具体依据**
✗ "这个目标可能有漏洞"
✓ "Finding F-003 确认 SMB 签名未启用，当前凭证 user@corp.local 有效，具备 NTLM relay 条件"

**execute_intent 前确认 approved 状态**
list_intents(status="approved") 确认后再调用 execute_intent。

**Finding 与 Intent 解耦**
create_finding 不传 intent_id，Finding 是纯粹的事实记录。
升级后单独调用 update_intent_status(id, "elevated", finding_id=...) 关联。
```

---

## 不在本次范围内

- Intent 的 Markdown 持久化（有意排除，见 ADR-7）
- Intent 的历史归档/导出
- 多 Goal 并行管理
- AI 自动审批（始终需要人类点击 Approve）

---

## 影响范围

| 文件/模块 | 变更类型 |
|-----------|---------|
| `src/core/domain/intent.ts` | 新增 |
| `src/features/intent/` | 新增模块 |
| `src/features/mcp/httpServer.ts` | 新增 5 个工具 + 增强 `get_engagement_summary` |
| `src/app/activate.ts` | 注册 Intent 功能 |
| `src/app/registerCommands.ts` | 注册 approve/skip 命令 |
| `docs/skills/pentest-with-weaponized/SKILL.md` | 更新工具表 + 新增 Pattern 5 |
| `package.json` | 注册 TreeView + 命令贡献点 |
