# Weaponized VSCode Extension：重分块/重分包重构建议

## 1. 我对项目的理解（基于当前代码）

这是一个面向渗透测试/安全工作流的 VSCode 扩展，核心能力围绕“Markdown 笔记驱动”：

- 在 `hosts/ users/ services/` 下的 Markdown 中，通过 ```yaml host``` / ```yaml credentials``` 维护目标与凭证。
- 扩展把这些 YAML 解析到 `workspaceState`（`Context.HostState / Context.UserState`），并进一步导出到 `environmentVariableCollection`，供终端/任务/命令使用（如 `$TARGET/$RHOST/$USER/$PASS` 等）。
- 通过 CodeLens 在 Markdown 上提供快捷动作（导出 env、dump、scan、set current、HTTP repeater、创建 foam note、执行 shell 代码块）。
- 提供一组 commands（setup/init、dump、switch、run command、http request、msfvenom/hashcat/scan 等）和终端辅助（profiles + terminal recorder）。

当前入口关系：

- `src/extension.ts`：activate 里注册 `variableProcessor`、`commands`、`codelens`、`terminal`、`definition`。
- “领域数据”在 `src/model/*`（Host/UserCredential + dump/parse）。
- “Markdown → state/env”在 `src/variableProcessor/*`（扫描文件、解析 YAML codeblock、写入 env collection）。
- “交互入口”分散在 `src/commands/*` 与 `src/codelens/*`（并且存在重复的 Markdown 解析逻辑）。

## 2. 当前结构的主要痛点（影响可维护性/扩展性）

1) **按“技术形态”分包（commands/codelens/variableProcessor/terminal）导致跨目录耦合**  
   - 例如 `commands/switch/*` 依赖 `variableProcessor/syncHostMarkdown.getCodeblock`；codelens 又有另一套 fenced codeblock 解析逻辑。
   - 业务能力（host/user/http/task/terminal）被拆散，新增一个 feature 往往要同时改多个顶层目录。

2) **“Markdown codeblock 解析/替换”逻辑重复且脆弱**  
   - YAML block 的提取分别存在于：
     - `src/variableProcessor/syncHostMarkdown.ts#getCodeblock`
     - `src/codelens/yamlconfig/base.ts#MarkdownCodeLensProvider`
   - 这类逻辑应当收敛到一个“Markdown Block Parser”里，否则行为难以一致（尤其是替换/定位 startLine、block 边界等）。

3) **领域层与 VSCode API 粘连，难以测试/复用**  
   - `Context` 是静态全局，很多地方直接读写 `workspaceState` 和 `vscode.*`。
   - 一旦需要做“批量重写 Markdown”、“增加新状态源（services）”、“支持多 workspace folder”等，改动面会很大。

4) **命名/组织不一致带来认知成本**  
   - `resovler.ts`（拼写）/ `taskTermial.ts`（拼写）/ 混用 `utils.ts`（callback 类型）。
   - “setup 生成资产”在 `src/commands/setup`，但从概念上它是一个 feature；未来如果增加更多模板/初始化逻辑，会更难管理。

## 3. 重分包目标与原则

目标是让代码结构按“能力域（feature）”聚合、按“层（core/platform）”隔离 VSCode 依赖：

- **Feature-first**：host/user/http/tasks/terminal/setup… 各自成块，commands 与 codelens 在同一 feature 内聚合。
- **Core vs Platform**：纯逻辑（解析/建模/合并 env collects）留在 core；VSCode API（UI、FS、workspaceState、terminal）放在 platform/adapters。
- **单一来源**：Markdown fenced block 解析与 YAML 提取只有一套实现。
- **渐进迁移**：允许保留旧路径 re-export 一段时间，避免一次性大迁移。

## 4. 建议的目录结构（推荐方案：Feature-first + Core/Platform 分层）

建议把 `src/` 重构为如下骨架（示意）：

```
src/
  extension.ts                 # 仍可保留为 activate/deactivate
  app/
    activate.ts                # 组合根：注册各 feature
    registry.ts                # registerXxx(context) 聚合

  core/                        # 不直接依赖 vscode（尽量纯）
    domain/
      host.ts                  # Host + parse/dump（可拆到 host/ 子目录）
      user.ts
    markdown/
      fencedBlocks.ts          # 统一解析 ```...```，返回 blocks + range
      yamlBlocks.ts            # 在 fencedBlocks 基础上提取 yaml host/credentials/http 等
    env/
      collects.ts              # Collects/mergeCollects/envVarSafer
      variables.ts             # 变量解析（原 resovler.ts），可拆“纯替换”和“执行 command”
    state/
      types.ts                 # HostState/UserState 等接口

  platform/                    # 适配 VSCode API（可以薄封装）
    vscode/
      logger.ts                # output channel
      workspaceStateRepo.ts    # workspaceState 的读写（替代 Context 静态）
      envCollection.ts         # environmentVariableCollection 的写入
      ui.ts                    # quickPick/inputBox/clipboard 等薄封装（可选）

  features/
    setup/
      setupCommand.ts
      assets.ts                # 仍由脚本生成
      index.ts

    targets/                   # host + user 作为“目标域”聚合（也可拆成 host/ 与 user/）
      sync/
        markdownSync.ts        # 扫描文件/更新 state/env（原 variableProcessor）
        watcher.ts
      commands/
        dumpHosts.ts
        dumpUsers.ts
        switchHost.ts
        switchUser.ts
      codelens/
        yamlConfigLens.ts      # export/dump/set current/scan 等
      index.ts

    http/
      commands/
        rawRequest.ts
        requestToCurl.ts
      codelens/
        httpLens.ts
      index.ts

    terminal/
      profiles/
      recorder/
      commands/
        registerLogger.ts
        unregisterLogger.ts
      index.ts

    tasks/
      commands/
        scan.ts
        hashcat.ts
        msfvenom.ts
      terminals/
        taskTerminal.ts
      ui/
        filePicker.ts
      index.ts

    notes/
      codelens/
        noteLens.ts
      index.ts

    definitions/
      bloodhound.ts
      index.ts

  shared/
    types.ts                   # callback 等通用类型（跨 feature 复用）
```

为什么这样分：

- `features/targets` 把“host/user 这条业务链”聚在一起：解析 Markdown → 状态 → env → commands/codelens。
- `core/markdown` 收敛所有 fenced block 处理，避免现在“3 套解析”并存。
- `platform/vscode` 收敛 VSCode API 交互，降低 core 的不可测性。

## 5. 旧模块到新模块的映射建议（便于迁移）

- `src/model/*` → `src/core/domain/*`（并把 `util.ts` 拆到 `core/env/collects.ts`）
- `src/variableProcessor/*` → `src/features/targets/sync/*`（其中解析逻辑下沉到 `core/markdown`）
- `src/commands/dump/*` → `src/features/targets/commands/*`
- `src/commands/switch/*` → `src/features/targets/commands/*`
- `src/codelens/yamlconfig/*` → `src/features/targets/codelens/*`
- `src/codelens/httpreapter/*` + `src/commands/http/*` → `src/features/http/*`
- `src/terminal/*` → `src/features/terminal/*`
- `src/commands/tasks/*` → `src/features/tasks/*`
- `src/codelens/newnote/*` → `src/features/notes/*`
- `src/definition/*` → `src/features/definitions/*`
- `src/global/context.ts` → `src/platform/vscode/workspaceStateRepo.ts`（保留 `Context` 作为过渡层也可）
- `src/global/log.ts` → `src/platform/vscode/logger.ts`

## 6. 迁移步骤（建议按 PR 分阶段，避免大爆炸）

### Phase 0：只做目录与出口整理（无行为变化）

- 新建 `core/ platform/ features/ shared/` 目录骨架。
- 在旧目录下增加“re-export 过渡层”（例如旧 `src/model/index.ts` 暂时 re-export 新 `core/domain`），保证引用可渐进迁移。

### Phase 1：收敛 Markdown block 解析（收益最大、风险可控）

- 提取 `core/markdown/fencedBlocks.ts`：输出结构建议包含：
  - `language`（yaml/http/bash/…）
  - `info`（如 `yaml host` / `yaml credentials` 的 identity）
  - `range`（startLine/endLine，或 start/end offset）
  - `content`（block 内部文本，不含 fence）
- `variableProcessor` 与 `codelens` 统一改用这套解析输出，消除重复逻辑。

### Phase 2：把“状态/环境变量导出”从 VSCode API 里拆出来

- core：提供 `collectEnvironment(hosts, users, defaults) => Collects` 纯函数。
- platform：提供 `EnvCollectionWriter`（把 Collects 写入 `environmentVariableCollection`）。
- 这样 `targets/sync` 只负责：扫描 Markdown → 解析 → 更新 repo → 调用 writer。

### Phase 3：Feature-first 归位 commands/codelens

- 先迁移一个 feature（建议从 `http` 或 `tasks` 开始），验证目录与注册方式可行。
- 再迁移 `targets`（host/user）相关 commands/codelens/同步逻辑。
- 最后迁移 `terminal` 与 `definitions/notes`。

### Phase 4：清理技术债（可选，但强烈建议）

- 统一命名：`resovler.ts`→`resolver.ts`，`taskTermial.ts`→`taskTerminal.ts`，避免长期拼写错带来的维护成本。
- 把 `callback` 类型放到 `shared/types.ts`，避免跨层依赖 `commands/utils.ts`。
- 清理未使用依赖/未使用 import（例如 `switch/user.ts` 的 `cp`）。

## 7. 可顺带解决的“结构性问题”（不要求立即改，但应在重构中顺手）

这些点不属于“分包”本身，但与分层后质量会明显提升：

- `replacer` 对 `startLine` 的判断用 `!startLine` 会导致 `0` 行无法替换；建议改为显式 `startLine === undefined`。
- `defaultCollects` 在模块加载时读取 VSCode 配置；如果用户运行中修改配置，默认 collects 不会更新。建议把“读取配置”做成函数或 service（按需读取/缓存）。
- “扫描 Markdown 文件”的范围现在是 `**/*.md`（switch 命令）与 `targetFilePattern`（watcher）并存，建议统一为同一策略并明确排除 `.git/ node_modules/` 等。

## 8. 备选方案（如果你更偏向“按层”而非“按 feature”）

如果团队更熟悉分层架构，也可以采用：

- `src/ui/commands/*`、`src/ui/codelens/*`、`src/core/*`、`src/infra/*`

但从本项目特征（host/user/http/task/terminal 是可独立演进的能力块）看，**Feature-first 更能减少“改一个功能牵连多个目录”的情况**，新增/下线一个功能也更容易。

