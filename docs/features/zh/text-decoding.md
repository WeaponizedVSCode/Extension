# 文本解码

CyberChef Magic 自动编码检测与解码集成。

## 命令

```
weapon feature: Decode selected text
```

命令 ID：`weapon.magic_decoder`

## 使用方式

1. 在编辑器中选择需要解码的文本
2. 运行命令
3. CyberChef 在 VS Code 内置浏览器中打开，自动应用 Magic 配方

Magic 配方自动检测和解码以下编码：

- Base64
- URL 编码
- 十六进制
- 旋转密码（ROT13 等）
- 其他常见编码

## 关键文件

- `src/features/decoder/commands/cyberchef.ts`
