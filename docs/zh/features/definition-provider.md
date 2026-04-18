# 定义提供器

在 Markdown 文件中为 BloodHound 术语提供悬停提示和跳转定义功能。

## 工作原理

当你在 Markdown 文件中将鼠标悬停在 BloodHound 相关术语（Active Directory 攻击边和关系）上，或使用跳转定义时，扩展会显示：

- **悬停提示** — 术语的简要说明
- **跳转定义** — 打开包含详细文档的虚拟 Markdown 文档

这帮助渗透测试人员在 VS Code 中直接理解 AD 攻击原语，无需离开编辑器。

## 数据来源

描述数据来源于全面的 BloodHound 知识库（`blood_desc.json`，约 745KB），涵盖所有 BloodHound 边和关系类型。

## 关键文件

- `src/features/definitions/blood.ts` — BloodHound 专用提供器
- `src/features/definitions/baseProvider.ts` — 基础定义/悬停提供器
- `src/snippets/source/blood/blood_desc.json` — BloodHound 术语描述数据
