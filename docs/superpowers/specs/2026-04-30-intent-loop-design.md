# Intent Loop — AI 辅助渗透闭环系统设计

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Intent 系统（域模型 + workspaceState 队列 + 4 MCP 工具 + 1 工具增强 + TreeView UI + Skill 更新）

---

## 1. 背景与目标

### 1.1 现有能力

Weaponized VS Code 已具备三大支柱：

| 支柱 | 实现 | 对应 Cairn AI 概念 |
|------|------|--------------------|
| 事实记录 | Finding（Markdown 持久化） | Fact |
| 全态感知 | EngagementSummary（Hosts + Users + Findings + Graph） | Blackboard |
| 工具执行 | Terminal + MCP 工具 | Explore |

### 1.2 缺失环节

缺少**推理→行动**的闭环：AI 基于当前态势推理出假设，生成结构化行动计划，人类审批后执行，结果回流驱动下一轮推理。

### 1.3 设计目标

引入 Intent 层，补全 Cairn AI 黑板架构中 Reason → Intent → Explore 的循环。实现：

- 人类设定 Goal（战略目标）
- AI 读取全态上下文，推理生成 Intent（结构化假设 + 命令）
- 人类在 TreeView UI 审批/拒绝
- 系统执行已审批 Intent，捕获输出
- AI 分析输出：确认假设 → 升级为 Finding；否定假设 → 标记 dismissed
- 循环继续直到 Goal 达成或用户叫停

### 1.4 核心映射

```
Cairn AI:    Fact      →  Reason   →  Intent      →  Explore
Weaponized:  Finding      AI 分析     Intent 队列    execute_intent
             (Markdown)   (LLM)     (workspaceState) (Terminal)
```

---

## 2. 架构决策记录

### ADR-7：Intent 存 workspaceState，不写 Markdown

**决策：** Intent 全生命周期存 `workspaceState`，不生成 Markdown 文件。

**理由：**
- Intent 是工作记忆（思考过程），Finding 是结论（知识沉淀）——两者本质不同
- `workspaceState` 跨 VS Code 重启持久化，满足实际需要
- 避免 `intents/` 目录污染工作区，攻击思路不需要 git 版本控制
- Intent 域与 Finding 域完全解耦：Finding 不知道 Intent 的存在

### ADR-8：Finding 不耦合 Intent

**决策：** `create_finding` 不加 `intent_id` 参数，Finding 保持纯粹。

**理由：** Finding 记录「发现了什么」，不记录「如何发现的」。关联关系由 Intent 单向持有（`finding_id` 字段指向 Finding），不反向污染 Finding 域。这确保 Finding 模型在无 Intent 系统的场景下仍可独立使用。

### ADR-9：execute_intent 封装三步串联

**决策：** 新增 `execute_intent` 工具，内部封装 `send_to_terminal` → `read_terminal` → `update_intent_status`。

**理由：** MCP 工具贵精不贵多。AI 的推理链越短越准确，一个调用完成「执行命令 + 读取输出 + 更新状态」的完整闭环，避免 AI 手动协调三步操作时出错。

---

## 3. 数据模型

### 3.1 文件位置

`src/core/domain/intent.ts` — 纯 TypeScript，零 vscode 依赖。

### 3.2 类型定义

```typescript
export type IntentStatus =
  | "pending"     // AI 创建，等待人类审批
  | "approved"    // 人类已审批，待执行
  | "running"     // 正在执行中
  | "completed"   // 执行完成，有输出
  | "dismissed"   // 假设被否定或人类跳过
  | "elevated";   // 假设确认，已升级为 Finding

export interface Intent {
  id: string;               // 唯一 ID（格式：`intent-${Date.now()}`）
  hypothesis: string;       // 假设陈述，如 "DC01 存在 Kerberoastable 账号"
  reasoning: string;        // 推理依据，必须引用具体 Finding ID 或态势事实
  command: string;          // 完整可执行命令
  expected_outcome: string; // 确认假设所需的输出特征
  status: IntentStatus;
  terminal_id?: string;     // 指定终端 ID（不指定则用默认终端）
  output?: string;          // execute_intent 后捕获的终端输出
  finding_id?: string;      // 升级为 Finding 时关联的 Finding ID
  dismissed_reason?: string;// dismissed 时的原因说明
  created_at: string;       // ISO 8601 时间戳
  updated_at: string;       // ISO 8601 时间戳
}

export interface Goal {
  description: string;      // 如 "获取 corp.local 的 Domain Admin"
  phase?: string;           // "reconnaissance" | "exploitation" | "post-exploitation"
  constraints?: string;     // 如 "避免嘈杂扫描，不做持久化"
  updated_at: string;       // ISO 8601 时间戳
}
```

### 3.3 状态流转图

```
                ┌─────────────────────────────────────────────┐
                │                                             │
                ▼                                             │
pending ──► approved ──► running ──► completed ──► elevated   │
   │                                    │                     │
   │                                    ▼                     │
   └─────────────────────────────────► dismissed ◄────────────┘
```

各跳转触发者：

| 跳转 | 触发者 | 机制 |
|------|--------|------|
| pending → approved | 人类 | TreeView Approve 按钮 / `weapon.intent.approve` 命令 |
| pending → dismissed | 人类 | TreeView Skip 按钮 / `weapon.intent.skip` 命令 |
| approved → running | 系统 | `execute_intent` 内部自动设置 |
| running → completed | 系统 | `execute_intent` 读取输出后自动设置 |
| completed → elevated | AI | `update_intent_status` 传入 `finding_id` |
| completed → dismissed | AI | `update_intent_status` 传入 `dismissed_reason` |

---

## 4. 持久化设计

### 4.1 workspaceState 键名

| 键 | 类型 | 说明 |
|----|------|------|
| `weaponized.intentQueue` | `Intent[]` | 全部 Intent，按 `created_at` 升序 |
| `weaponized.goal` | `Goal \| null` | 当前渗透目标，`null` 表示未设置 |

### 4.2 队列清理策略

活跃 Intent（`pending` / `approved` / `running`）永不自动清理。
归档 Intent（`completed` / `dismissed` / `elevated`）保留最近 **50 条**，超出时删除最旧的。

清理在每次 `IntentQueue.add()` 后触发：

```typescript
private static pruneArchived(): void {
  const ARCHIVED_STATUSES: IntentStatus[] = ["completed", "dismissed", "elevated"];
  const MAX_ARCHIVED = 50;
  const all = IntentQueue.getAll();
  const archived = all
    .filter(i => ARCHIVED_STATUSES.includes(i.status))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (archived.length > MAX_ARCHIVED) {
    const idsToRemove = new Set(
      archived.slice(0, archived.length - MAX_ARCHIVED).map(i => i.id)
    );
    IntentQueue.saveAll(all.filter(i => !idsToRemove.has(i.id)));
  }
}
```

---

## 5. 新增模块结构

```
src/
  core/domain/
    intent.ts                 ← Intent / Goal 类型定义（零 vscode 依赖）

  features/intent/
    queue/
      intentQueue.ts          ← IntentQueue 静态类（workspaceState CRUD）
    treeview/
      intentTreeProvider.ts   ← VS Code TreeView Provider
      register.ts             ← 注册 TreeView 到 VS Code
    commands/
      approveIntent.ts        ← weapon.intent.approve 命令处理
      skipIntent.ts           ← weapon.intent.skip 命令处理
    index.ts                  ← barrel 导出 + registerIntentFeature() 入口
```

### 5.1 IntentQueue 类设计

`IntentQueue` 独立于 `Context` 单例，直接读写 `workspaceState`：

```typescript
// src/features/intent/queue/intentQueue.ts
export class IntentQueue {
  private static readonly QUEUE_KEY = "weaponized.intentQueue";
  private static readonly GOAL_KEY  = "weaponized.goal";

  static getAll(): Intent[]
  static add(intent: Intent): void          // 追加并触发 pruneArchived()
  static update(id: string, updates: Partial<Intent>): void
  static getByStatus(status: IntentStatus): Intent[]
  static getGoal(): Goal | null
  static setGoal(goal: Goal): void

  private static saveAll(intents: Intent[]): void
  private static pruneArchived(): void
}
```

**设计理由：** Intent 生命周期独立于 Host/User 状态，无需合并进 Context。MCP 工具和 TreeView 统一通过 `IntentQueue` 静态方法访问，不直接操作 workspaceState。

---

## 6. MCP 工具变更

设计原则：**工具贵精不贵多**。纯读操作通过增强 `get_engagement_summary` 覆盖，不单独建工具。

### 6.1 新增工具（4 个）

#### `set_goal`

| 属性 | 值 |
|------|---|
| 参数 | `description` (string, required), `phase?` (string), `constraints?` (string) |
| 行为 | 构建 Goal 对象，写入 `workspaceState.weaponized.goal`，触发 TreeView 刷新 |
| 用途 | engagement 开始时设定目标，或切换攻击阶段 |

#### `create_intent`

| 属性 | 值 |
|------|---|
| 参数 | `hypothesis` (string, required), `reasoning` (string, required), `command` (string, required), `expected_outcome` (string, required), `terminal_id?` (string) |
| 行为 | 生成 Intent 对象（`id: intent-${Date.now()}`, `status: "pending"`, 自动填充时间戳），追加到队列，触发 TreeView 刷新 |
| 约束 | `reasoning` 必须非空且包含具体依据（Finding ID 或态势事实），不允许泛泛而谈 |
| 用途 | AI 推理后批量创建行动意图 |

#### `update_intent_status`

| 属性 | 值 |
|------|---|
| 参数 | `id` (string, required), `status` (IntentStatus, required), `dismissed_reason?` (string), `finding_id?` (string) |
| 行为 | 更新指定 Intent 的 status 和关联字段，更新 `updated_at`，写回 workspaceState，触发 TreeView 刷新 |
| 约束 | `status=dismissed` 时 `dismissed_reason` 必填；`status=elevated` 时 `finding_id` 必填 |
| 用途 | AI 分析输出后标记假设确认/否定 |

#### `execute_intent`

| 属性 | 值 |
|------|---|
| 参数 | `id` (string, required) |
| 前置条件 | 目标 Intent 的 `status` 必须为 `"approved"` |
| 执行序列 | 1. `status → "running"`<br>2. `send_to_terminal(terminal_id ?? 默认终端, command)`<br>3. 等待 2000ms（Shell Integration 缓冲）<br>4. `read_terminal(terminal_id) → output`<br>5. `Intent.output = output, status → "completed"`<br>6. 触发 TreeView 刷新<br>7. 返回 `{ id, command, output }` |
| 默认终端选择 | 若 `terminal_id` 未指定，取 `TerminalBridge.getTerminals()` 中序号最小（最早创建）且非 running 状态的终端。若无终端存在，返回错误提示先 `create_terminal` |
| 用途 | 替代 AI 手动串联 send_to_terminal + read_terminal + update 三步操作 |

**等待策略说明：** `execute_intent` 语义为「启动命令 + 读取初始输出」，不等待命令完成。对于长命令（nmap、hashcat），AI 应在 `expected_outcome` 中说明「输出为初始进度」，后续轮次用 `read_terminal` 跟踪完整结果。

### 6.2 增强现有工具（1 个）

#### `get_engagement_summary` — 新增 `include_intents` 参数

```
新增参数: include_intents? (boolean, default: false)

当 include_intents=true 时，响应增加以下字段:
  goal: Goal | null
  intents: Intent[]              // 全部 Intent（供 AI 过滤）
  intentStats: {
    pending: number,
    approved: number,
    running: number,
    completed: number,
    dismissed: number,
    elevated: number
  }
```

此参数与现有 `include_graph` 参数正交，可独立或同时使用。

**设计说明：** 原方案中的 `get_goal` 和 `list_intents` 两个纯读工具已合并至此。AI 通过一次 `get_engagement_summary(include_intents=true)` 调用即可获取 goal + intents + stats 全量信息，无需额外工具。

---

## 7. TreeView UI

### 7.1 视觉结构

```
WEAPON INTENTS
─────────────────────────────────────
  🎯 获取 corp.local domain admin    [编辑]
     阶段: exploitation
     约束: 避免嘈杂扫描

  ▼ Pending (2)
      [●] Kerberoast DC01            [✓ Approve] [✗ Skip]
           DC01 存在 SPNs
      [●] SMB relay via NTLM         [✓ Approve] [✗ Skip]
           SMB 签名未启用 + 有效凭证

  ▼ Approved (1)
      [►] SQLi dump users table

  ▼ Running (1)
      [⟳] Enum SMB shares...

  ▼ Completed (3)  ▸ (默认折叠)
  ▼ Dismissed (1)  ▸ (默认折叠)
```

### 7.2 命令注册

| 命令 ID | 标题 | 行为 |
|---------|------|------|
| `weapon.intent.approve` | Approve Intent | `pending → approved`，触发 TreeView 刷新 |
| `weapon.intent.skip` | Skip Intent | `pending → dismissed`（dismissed_reason = "Skipped by user"），触发刷新 |
| `weapon.intent.setGoal` | Weapon: Set Engagement Goal | InputBox 输入 description/phase/constraints |

### 7.3 刷新机制

`IntentTreeProvider` 持有 `EventEmitter<void>`，暴露 `onDidChangeTreeData` 事件：

```typescript
private _onDidChangeTreeData = new vscode.EventEmitter<void>();
readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

refresh(): void {
  this._onDidChangeTreeData.fire();
}
```

**触发点：** 所有写操作后必须调用 `refresh()`：
- MCP 工具：`create_intent`、`update_intent_status`、`execute_intent`、`set_goal`
- 命令：`weapon.intent.approve`、`weapon.intent.skip`

**接入方式：** `EmbeddedMcpServer` 构造参数接收 `IntentTreeProvider` 引用（与现有 `TerminalBridge` 传参模式一致）。

### 7.4 TreeItem.contextValue 约定

| contextValue | 状态 | 显示按钮 |
|--------------|------|----------|
| `"intent-pending"` | pending | Approve + Skip |
| `"intent-approved"` | approved | — |
| `"intent-running"` | running | — |
| `"intent-done"` | completed / dismissed / elevated | — |

---

## 8. Skill 更新

文件：`docs/skills/pentest-with-weaponized/SKILL.md`

### 8.1 新增工具表节

```markdown
### Goal & Intent（半自动渗透闭环）

| 工具 | 用途 | 何时使用 |
|------|------|---------|
| set_goal | 设置渗透目标和阶段约束 | engagement 开始或切换攻击阶段 |
| create_intent | 写入带推理的行动意图 | 每轮推理后批量创建 |
| update_intent_status | 更新意图状态（dismiss/elevate） | 分析输出结果后 |
| execute_intent | 执行已审批意图（自动读取输出） | 有 approved Intent 时 |
| get_engagement_summary | 读取全量上下文含 Intent | include_intents=true 获取 goal+intents |
```

### 8.2 新增 Pattern 5：Intent Loop

```markdown
### Pattern 5: AI-Driven Intent Loop（半自动渗透闭环）

**完整循环：**

1. get_engagement_summary(include_intents=true)
   → 一次调用获取全量上下文（goal + intents + stats + Findings + Hosts + Users）

2. create_intent × N（批量，不要单条）
   → 本轮推理生成的所有行动意图
   → reasoning 必须引用具体 Finding ID 或态势事实

3. [等待人类在 TreeView 审批]
   → get_engagement_summary(include_intents=true) 确认哪些已 approved

4. execute_intent(id)
   → 自动执行 + 读取输出（无需手动 send+read）

5. 分析 output:
   ├─ 假设确认 → create_finding(...) + update_intent_status(id, "elevated", finding_id=...)
   └─ 假设否定 → update_intent_status(id, "dismissed", dismissed_reason="...")

6. 回到步骤 1（循环，直到 Goal 达成或用户叫停）
```

### 8.3 新增 Intent 使用规则

```markdown
## Intent 使用规则

**批量创建，不要单条**
每轮 Reason 后一次性 create_intent 多条，让人类看到完整攻击思路再审批。

**reasoning 必须引用具体依据**
✗ "这个目标可能有漏洞"
✓ "Finding F-003 确认 SMB 签名未启用，当前凭证 user@corp.local 有效，具备 relay 条件"

**execute_intent 前确认 approved 状态**
get_engagement_summary(include_intents=true) 确认后再调用 execute_intent，避免操作未审批的 Intent。

**Finding 与 Intent 解耦**
create_finding 不传 intent_id——Finding 是纯粹的事实记录。
升级后单独调用 update_intent_status(id, "elevated", finding_id=...) 建立关联。

**长命令的处理**
对 nmap、hashcat 等长运行命令，expected_outcome 注明"初始输出为进度信息"。
execute_intent 返回后用 read_terminal 在后续轮次跟踪完整结果。
```

---

## 9. package.json 贡献点

```jsonc
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "weaponized-intent",
        "title": "Weapon Intents",
        "icon": "resources/icons/intent.svg"
      }]
    },
    "views": {
      "weaponized-intent": [{
        "id": "weaponized.intentView",
        "name": "Intents"
      }]
    },
    "commands": [
      {
        "command": "weapon.intent.approve",
        "title": "Approve Intent",
        "icon": "$(check)"
      },
      {
        "command": "weapon.intent.skip",
        "title": "Skip Intent",
        "icon": "$(close)"
      },
      {
        "command": "weapon.intent.setGoal",
        "title": "Weapon: Set Engagement Goal"
      }
    ],
    "menus": {
      "view/item/context": [
        {
          "command": "weapon.intent.approve",
          "when": "view == weaponized.intentView && viewItem == intent-pending",
          "group": "inline"
        },
        {
          "command": "weapon.intent.skip",
          "when": "view == weaponized.intentView && viewItem == intent-pending",
          "group": "inline"
        }
      ]
    }
  }
}
```

需新增图标文件 `resources/icons/intent.svg`。

---

## 10. 测试策略

遵循现有惯例——仅测试 `core/` 层（零 VS Code 依赖）：

| 测试文件 | 覆盖内容 |
|----------|----------|
| `src/test/unit/core/domain/intent.test.ts` | IntentStatus 合法值枚举、Intent 必填字段验证、Goal 结构验证、时间戳格式 |

`IntentQueue`（依赖 workspaceState）和 `IntentTreeProvider`（依赖 VS Code TreeView API）不在本次单元测试范围，与现有 `features/` 层无测试的项目惯例保持一致。

---

## 11. 影响范围

| 文件 / 模块 | 变更类型 | 说明 |
|-------------|----------|------|
| `src/core/domain/intent.ts` | **新增** | Intent / Goal 类型定义 |
| `src/core/index.ts` | 修改 | 新增 barrel 导出 |
| `src/features/intent/` | **新增模块** | queue + treeview + commands |
| `src/features/mcp/httpServer.ts` | 修改 | 新增 4 工具 + 增强 get_engagement_summary |
| `src/app/activate.ts` | 修改 | 调用 registerIntentFeature() |
| `src/app/registerCommands.ts` | 修改 | 注册 approve / skip / setGoal 命令 |
| `docs/skills/pentest-with-weaponized/SKILL.md` | 修改 | 工具表 + Pattern 5 + 使用规则 |
| `package.json` | 修改 | viewsContainers + views + commands + menus |
| `resources/icons/intent.svg` | **新增** | TreeView 侧边栏图标 |
| `src/test/unit/core/domain/intent.test.ts` | **新增** | 域模型单元测试 |

---

## 12. 不在本次范围内

- Intent 的 Markdown 持久化（有意排除，见 ADR-7）
- Intent 的历史归档 / 导出功能
- 多 Goal 并行管理
- AI 自动审批（始终需要人类点击 Approve，这是安全边界）
- Intent 的撤销 / 回滚机制
- Intent 间的依赖关系（顺序 / 阻塞）
