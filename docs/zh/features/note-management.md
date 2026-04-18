# 笔记管理

基于 Foam 的结构化笔记系统，含自动化报告生成和攻击路径分析。

## 前置条件

需要安装 **Foam** 扩展（`foam.foam-vscode`）。

## 创建笔记

```
weapon foam: Create/New note (user/host/service) from foam template
```

命令 ID：`weapon.note.creation`

### 可用模板

| 模板 | 说明 |
|------|------|
| `host.md` | 主机信息笔记 |
| `user.md` | 用户凭证笔记 |
| `service.md` | 服务信息笔记 |
| `finding.md` | 发现/漏洞笔记 |
| `report.js` | 自动生成渗透测试报告 |

## 报告生成

`report.js` 模板执行自动化分析：

1. **图关系分析** — 解析所有笔记，构建引用关系图
2. **攻击路径计算** — 使用 **Tarjan SCC 算法** + DAG 拓扑排序找到最长的权限提升链
3. **Mermaid 图表生成** — 可视化用户关系图
4. **报告内容**：
   - 主机信息摘要
   - 完整关系图（Mermaid 格式）
   - 权限提升路径（按攻击顺序排列）
   - 额外获取的用户

### 最佳实践

- 在用户笔记中使用 `[[link]]` 语法链接到下一个获取的用户
- 设置笔记 `type` 属性为 `user`、`host` 或 `service`
- 维护清晰的引用关系以确保攻击路径生成准确

## 关系图

```
weapon foam: Show Foam Graph
```

可视化主机、用户和服务之间的关系。

## 笔记创建 CodeLens

扩展会检测笔记中类似 "get user X" 或 "own host Y" 的短语，并提供 **Create note for X** CodeLens 按钮。

## 关键文件

- `src/features/notes/reports/report.ts` — 报告生成与图分析
- `src/features/notes/reports/assets.ts` — 笔记模板
- `src/features/notes/codelens/noteProvider.ts` — 笔记创建 CodeLens
