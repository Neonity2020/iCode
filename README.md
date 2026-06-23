# iCode

iCode 是一个基于 Electron + React 的本地桌面工作台，用来在当前工作区里驱动 Codex CLI 完成编码任务。它提供任务会话、模型切换、审批确认、运行中断和本地状态持久化，界面通过 Codex 的真实事件流更新，不依赖模拟数据。

## 特性

- 选择本地工作区，并在该目录内启动任务
- 创建和管理多个任务会话
- 在多个模型之间切换
- 展示 Codex 的消息、活动和审批请求
- 允许或拒绝命令执行、文件修改等操作
- 中断正在运行的 turn
- 自动保存会话、工作区和侧栏状态到本地

## 技术栈

- Electron 40
- React 19
- Vite 8
- Vite+
- TypeScript 6

## 运行前提

- 已安装 `pnpm`
- 已安装并登录 Codex CLI
- 终端中可直接访问 `codex`，或者设置 `CODEX_CLI_PATH`

Codex 可执行文件会按以下顺序查找：

1. `CODEX_CLI_PATH`
2. `/opt/homebrew/bin/codex`
3. `/usr/local/bin/codex`
4. `codex`

## 安装

```bash
pnpm install
```

## 开发

启动完整开发环境：

```bash
pnpm run dev
```

这个命令会先启动 Vite 开发服务，再拉起 Electron 窗口。

如果你只想单独运行前端开发服务：

```bash
pnpm run dev:web
```

## 检查与构建

```bash
pnpm run check
pnpm run build
```

- `check` 会运行项目检查
- `build` 会先检查，再生成前端构建产物

## 运行桌面应用

构建完成后启动 Electron：

```bash
pnpm run start
```

## 使用方式

1. 启动应用后，先选择一个工作区目录
2. 点击“新任务”创建会话
3. 输入你希望 Codex 完成的工作
4. 当 Codex 请求权限时，按需允许或拒绝
5. 如果需要停止当前任务，点击停止按钮

## 工作原理

iCode 的主进程会启动 `codex app-server --listen stdio://`，并通过 preload 暴露最小化的 IPC 接口给渲染进程。界面中的消息、活动、审批和错误状态都来自真实的 Codex 事件流。

应用还会把会话状态、当前工作区、模型选择和侧栏状态保存在本地，重启后可以恢复最近的任务上下文。

## 配置说明

### `CODEX_CLI_PATH`

可选。用于显式指定 Codex CLI 可执行文件路径。

### `CODEX_SQLITE_HOME`

由应用自动设置，用来存放 Codex 的本地状态数据，不需要手动配置。

## 目录结构

```text
electron/
  main.mjs      # Electron 主进程
  preload.cjs   # 安全的渲染进程桥接
scripts/
  dev.mjs       # 同时启动 Vite 和 Electron
src/
  App.tsx       # 主界面
  main.tsx      # React 入口
  styles.css    # 样式
```

## 注意事项

- 应用要求 Codex CLI 已完成登录和初始化
- 如果 Codex 启动失败，先检查 CLI 是否可执行、是否在 PATH 中，以及当前账号是否已登录
- 当前实现会把会话状态写入浏览器本地存储，适合单机本地使用
