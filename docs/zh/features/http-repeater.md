# HTTP 请求重放

从 Markdown 代码块发送原始 HTTP 请求，并转换为 cURL 命令。

## 使用方式

在 Markdown 文件中编写 ```` ```http ```` 代码块：

````markdown
```http
POST /api/login HTTP/1.1
Host: target.htb
Content-Type: application/json
Content-Length: 42

{"username": "admin", "password": "test"}
```
````

## CodeLens 操作

- **Send HTTP Request** — 通过 HTTP 发送请求，在并排编辑器中显示响应
- **Send HTTPS Request** — 通过 HTTPS 发送请求（已禁用 SSL 验证）
- **Copy in curl (HTTP)** / **Copy in curl (HTTPS)** — 转换为 cURL 命令并复制到剪贴板

## 响应显示

响应在只读虚拟文档中打开，显示完整的 HTTP 响应，包括请求头和响应体。

## 关键文件

- `src/features/http/commands/rawRequest.ts` — 通过 `node-fetch` 发送请求并显示响应
- `src/features/http/commands/requestToCurl.ts` — 转换为 cURL 命令
- `src/features/http/codelens/send.ts` — 发送 HTTP/HTTPS CodeLens
- `src/features/http/codelens/curl.ts` — 复制 cURL CodeLens
