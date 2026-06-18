# iCode

> One Project. Multiple Coding Agents.

iCode is a project-centric desktop workspace for Codex, Claude Code, and OpenCode. The product model is built around projects, sessions, agent runs, handoffs, and Git state rather than standalone chat threads.

## Development

This project uses [bun](https://bun.sh) for package management and scripts, organized as a monorepo.

```bash
bun install
bun run dev
```

Useful checks:

```bash
bun run typecheck   # type-check all workspace packages
bun run lint        # eslint across the repo
bun run package     # build & package the desktop app
bun run build:shared # emit @icode/shared dist artifacts
```

## Repository layout

```text
apps/
└── desktop/   @icode/desktop — Electron app (main, preload, and React renderer)
packages/
└── shared/    @icode/shared  — domain models and IPC contracts (types + IPC_CHANNELS)
```

`@icode/desktop` owns the complete deployable application, including its Electron
Forge and Vite configuration. Its `main`, `preload`, and `renderer` directories are
process boundaries within one app, not independently versioned packages.

`@icode/shared` is a dependency-free leaf package for contracts that can be reused
by desktop and future applications.

### Path resolution

Cross-package imports use the `@icode/shared` package name. Each Vite config maps this name to the shared source so it resolves correctly in both dev and packaged builds without relying on `node_modules` symlinks.

## Next Milestones

1. Add SQLite repositories for projects, sessions, agent runs, timeline entries, and handoff context.
2. Add `node-pty` agent runtimes and streaming IPC.
3. Connect native project selection, file browsing, and Git status/diff services.
4. Replace the representative renderer data with persisted project state.
