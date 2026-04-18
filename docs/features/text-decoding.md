# Text Decoding

CyberChef Magic recipe integration for automatic encoding detection and decoding.

## Command

```
weapon feature: Decode selected text
```

Command ID: `weapon.magic_decoder`

## How It Works

1. Select text in the editor
2. Run the command
3. CyberChef opens in VS Code's simple browser with the "Magic" recipe auto-applied

The Magic recipe automatically detects and decodes:

- Base64
- URL encoding
- Hex
- Rotation ciphers (ROT13, etc.)
- Other common encodings

## Key Files

- `src/features/decoder/commands/cyberchef.ts`
