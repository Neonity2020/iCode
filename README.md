# iCode

iCode 是一个面向 Codex 的多端工作台。仓库采用 pnpm monorepo，同时提供 Electron
桌面应用和 Web 应用；两端共享同一套 React 产品代码，仅在平台能力层区分本地 IPC
与浏览器实现。

## Workspace

```text
apps/
  desktop/          # Electron 主进程、preload、桌面渲染入口
  web/              # Web 入口与浏览器平台适配器
packages/
  app/              # 两端共享的 React UI、状态、业务逻辑
  platform/         # 跨端平台能力接口与协议类型
scripts/
  dev-config.mjs    # desktop/web 开发端口的唯一配置入口
  run-app.mjs       # 根目录 app 命令调度器
```

`packages/app` 不直接依赖 Electron，也不访问 `window.icode`。它通过
`PlatformProvider` 使用 `@icode/platform` 定义的能力，因此 desktop 和 web 不需要
复制组件、状态或 Codex 事件处理逻辑。

## 开发

安装依赖：

```bash
pnpm install
```

启动桌面应用：

```bash
pnpm dev
# 或 pnpm dev:desktop
```

启动 Web 应用：

```bash
pnpm dev:web
```

默认端口：

- desktop renderer: `5173`
- web: `5174`

可以通过 `ICODE_DESKTOP_PORT` 和 `ICODE_WEB_PORT` 覆盖。Electron 与 desktop Vite
服务始终读取同一个 desktop 端口配置。

## 检查与构建

```bash
pnpm check
pnpm build
```

也可以单独构建：

```bash
pnpm build:desktop
pnpm build:web
```

构建产物分别位于 `apps/desktop/dist` 和 `apps/web/dist`。

## 平台能力

Desktop 通过 Electron preload 提供：

- Codex CLI app-server
- 本地工作区选择与文件树
- PTY 终端
- Finder 与外部链接集成

Web 已经复用完整应用 UI、会话状态和业务逻辑，并提供独立开发与生产构建。目前 Web
平台适配器会明确显示“Codex 服务尚未配置”，本地文件树和终端入口也会隐藏。下一步只需
为 `apps/web/src/platform.ts` 接入远程 Codex/WebSocket/HTTP 网关，无需重写共享 UI。

## Desktop 前提

- 已安装并登录 Codex CLI
- 终端中可访问 `codex`，或设置 `CODEX_CLI_PATH`

Codex 可执行文件依次从 `CODEX_CLI_PATH`、Homebrew 常见路径、当前 `PATH` 和登录
shell 中查找。
