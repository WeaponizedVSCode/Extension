# HTTP Repeater

Send raw HTTP requests and convert to cURL commands directly from Markdown code blocks.

## Usage

Write raw HTTP requests in ```` ```http ```` blocks:

````markdown
```http
POST /api/login HTTP/1.1
Host: target.htb
Content-Type: application/json
Content-Length: 42

{"username": "admin", "password": "test"}
```
````

## CodeLens Actions

- **Send HTTP Request** — Execute via HTTP, display response in side-by-side editor
- **Send HTTPS Request** — Execute via HTTPS (SSL verification disabled)
- **Copy in curl (HTTP)** / **Copy in curl (HTTPS)** — Convert to cURL command and copy to clipboard

## Response Display

Responses open in a read-only virtual document showing the full HTTP response including headers and body.

## Key Files

- `src/features/http/commands/rawRequest.ts` — Sends request via `node-fetch`, displays response
- `src/features/http/commands/requestToCurl.ts` — Converts to cURL command
- `src/features/http/codelens/send.ts` — Send HTTP/HTTPS CodeLens
- `src/features/http/codelens/curl.ts` — Copy in curl CodeLens
