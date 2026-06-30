# iCode

iCode 是一个面向 Codex 的桌面工作台，使用 pnpm monorepo 组织代码。
当前仓库包含 Electron 桌面应用、marketing 官网，以及共享的应用层和平台契约。

## 项目结构

```text
apps/
  desktop/          # Electron 主进程、preload、桌面渲染入口
marketing/          # 官网 Landing Page
packages/
  app/              # 共享的 React UI、状态、业务逻辑
  platform/         # 跨端平台能力接口与协议类型
scripts/
  dev-config.mjs    # 开发端口配置
  run-app.mjs       # 根目录 app 命令调度器
```

`packages/app` 通过 `PlatformProvider` 读取 `@icode/platform` 定义的能力，不直接依赖
Electron 或 `window.icode`。桌面端负责提供本地文件系统、PTY 终端和 Codex CLI 能力。

## 代码规模

按 git 跟踪的源码文件统计，排除 Markdown 文档、lockfile、JSON 配置、缓存目录和未跟踪文件：

| 类型     | 文件数 | 物理行数 |   非空行 |
| -------- | -----: | -------: | -------: |
| `.tsx`   |     17 |     3330 |     3156 |
| `.css`   |      2 |     2943 |     2844 |
| `.ts`    |     14 |     1170 |     1071 |
| `.mjs`   |      5 |     1161 |     1050 |
| `.html`  |      3 |      396 |      381 |
| `.py`    |      1 |      121 |       99 |
| `.cjs`   |      1 |       46 |       45 |
| **合计** | **43** | **9167** | **8646** |

## 快速开始

安装依赖：

```bash
pnpm install
```

启动桌面应用：

```bash
pnpm dev
```

启动 marketing 官网：

```bash
pnpm dev:marketing
```

常用脚本：

- `pnpm dev:desktop`，启动桌面应用
- `pnpm dev:marketing`，启动 marketing 官网
- `pnpm check`，运行类型检查和工程检查
- `pnpm build`，构建所有包和应用
- `pnpm build:desktop`，仅构建桌面应用
- `pnpm build:marketing`，仅构建 marketing 官网
- `pnpm preview:marketing`，预览 marketing 构建结果

默认端口：

- desktop renderer: `5173`
- marketing: `5174`

可以通过 `ICODE_DESKTOP_PORT` 和 `ICODE_MARKETING_PORT` 覆盖。Electron 和桌面 Vite 服务会
读取同一套桌面端口配置。

## 构建与检查

```bash
pnpm check
pnpm build
```

构建产物分别位于 `apps/desktop/dist` 和 `marketing/dist`。

## 桌面端能力

Desktop 通过 Electron preload 提供：

- Codex CLI app-server
- 本地工作区选择与文件树
- PTY 终端
- Finder 与外部链接集成

## 运行前提

- 已安装并登录 Codex CLI
- 终端中可访问 `codex`，或设置 `CODEX_CLI_PATH`

Codex 可执行文件会依次从 `CODEX_CLI_PATH`、Homebrew 常见路径、当前 `PATH` 和登录
shell 中查找。

## 进一步阅读

- [架构说明](./ARCHITECTURE.md)
