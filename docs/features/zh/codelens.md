# CodeLens

在 Markdown 文件的代码块上方显示内联操作按钮，提供一键访问常用操作。

## CodeLens 类型

### YAML 主机块

在 ```` ```yaml host ```` 块上：

- **export to terminal** — 导出主机数据为 Shell 环境变量
- **export as current** — 设为当前主机并导出
- **set as current** / **unset as current** — 就地切换 `is_current` 标志
- **Scan host** — 对该块中的目标启动扫描

### YAML 凭证块

在 ```` ```yaml credentials ```` 块上：

- **export to terminal** / **export as current**
- **dump as impacket** — 格式化为 Impacket 工具格式
- **dump as nxc** — 格式化为 NetExec 格式
- **set as current** / **unset as current**

### Shell 代码块

在 ```` ```bash ````, ```` ```sh ````, ```` ```zsh ````, ```` ```powershell ```` 块上：

- **Run command in terminal** — 在活动终端中执行
- **Copy commands** — 复制到剪贴板

### HTTP 代码块

在 ```` ```http ```` 块上：

- **Send HTTP Request** / **Send HTTPS Request**
- **Copy in curl (HTTP)** / **Copy in curl (HTTPS)**

### 笔记创建

在 "get user X" 或 "own host Y" 等短语上：

- **Create note for X** — 为引用的实体创建 Foam 笔记

## 关键文件

- `src/features/targets/codelens/` — YAML 主机/凭证 CodeLens
- `src/features/shell/codelens/commandProvider.ts` — Shell 块 CodeLens
- `src/features/http/codelens/` — HTTP 块 CodeLens
- `src/features/notes/codelens/noteProvider.ts` — 笔记创建 CodeLens
