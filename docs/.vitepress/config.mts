import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Weaponized VSCode',
  description: 'A VSCode extension for penetration testing workflows',
  base: '/Extension/',

  head: [
    ['link', { rel: 'icon', href: '/Extension/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/icon.png',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/WeaponizedVSCode/Extension' },
    ],
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: 'https://github.com/WeaponizedVSCode/Extension/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Features', link: '/features/workspace-setup' },
          { text: 'Architecture', link: '/architecture/ai-integration' },
        ],
        sidebar: {
          '/features/': [
            {
              text: 'Features',
              items: [
                { text: 'Workspace Setup', link: '/features/workspace-setup' },
                { text: 'Host Management', link: '/features/host-management' },
                { text: 'Credential Management', link: '/features/credential-management' },
                { text: 'Environment Variables', link: '/features/environment-variables' },
                { text: 'CodeLens', link: '/features/codelens' },
                { text: 'Shell Command Runner', link: '/features/shell-command-runner' },
                { text: 'HTTP Repeater', link: '/features/http-repeater' },
                { text: 'Payload Generation', link: '/features/payload-generation' },
                { text: 'Network Scanning', link: '/features/network-scanning' },
                { text: 'Password Cracking', link: '/features/password-cracking' },
                { text: 'Terminal Profiles', link: '/features/terminal-profiles' },
                { text: 'Terminal Recorder', link: '/features/terminal-recorder' },
                { text: 'Terminal Bridge', link: '/features/terminal-bridge' },
                { text: 'Text Decoding', link: '/features/text-decoding' },
                { text: 'Note Management', link: '/features/note-management' },
                { text: 'Code Snippets', link: '/features/code-snippets' },
                { text: 'Definition Provider', link: '/features/definition-provider' },
                { text: 'AI Chat Participant', link: '/features/ai-chat-participant' },
                { text: 'MCP Server', link: '/features/mcp-server' },
              ],
            },
          ],
          '/architecture/': [
            {
              text: 'Architecture',
              items: [
                { text: 'AI Integration', link: '/architecture/ai-integration' },
                { text: 'Copilot Chat', link: '/architecture/copilot-chat' },
                { text: 'MCP Server Guide', link: '/architecture/mcp-server' },
                { text: 'Code Quality', link: '/architecture/code-quality' },
                { text: 'Testing Strategy', link: '/architecture/testing-strategy' },
                { text: 'Feature Roadmap', link: '/architecture/feature-roadmap' },
              ],
            },
          ],
        },
      },
    },
    zh: {
      label: '中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '功能', link: '/zh/features/workspace-setup' },
        ],
        sidebar: {
          '/zh/features/': [
            {
              text: '功能',
              items: [
                { text: '工作区初始化', link: '/zh/features/workspace-setup' },
                { text: '主机管理', link: '/zh/features/host-management' },
                { text: '凭证管理', link: '/zh/features/credential-management' },
                { text: '环境变量', link: '/zh/features/environment-variables' },
                { text: 'CodeLens', link: '/zh/features/codelens' },
                { text: 'Shell 命令执行', link: '/zh/features/shell-command-runner' },
                { text: 'HTTP 请求重放', link: '/zh/features/http-repeater' },
                { text: '载荷生成', link: '/zh/features/payload-generation' },
                { text: '网络扫描', link: '/zh/features/network-scanning' },
                { text: '密码破解', link: '/zh/features/password-cracking' },
                { text: '终端配置文件', link: '/zh/features/terminal-profiles' },
                { text: '终端录制器', link: '/zh/features/terminal-recorder' },
                { text: '终端桥接', link: '/zh/features/terminal-bridge' },
                { text: '文本解码', link: '/zh/features/text-decoding' },
                { text: '笔记管理', link: '/zh/features/note-management' },
                { text: '代码片段', link: '/zh/features/code-snippets' },
                { text: '定义提供器', link: '/zh/features/definition-provider' },
                { text: 'AI 聊天助手', link: '/zh/features/ai-chat-participant' },
                { text: 'MCP 服务器', link: '/zh/features/mcp-server' },
              ],
            },
          ],
        },
        editLink: {
          pattern: 'https://github.com/WeaponizedVSCode/Extension/edit/master/docs/:path',
          text: '在 GitHub 上编辑此页',
        },
      },
    },
  },
})
