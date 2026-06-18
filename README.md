# iCode

> One Project. Multiple Coding Agents.

iCode is a project-centric desktop workspace for Codex, Claude Code, and OpenCode. The product model is built around projects, sessions, agent runs, handoffs, and Git state rather than standalone chat threads.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run package
```

## Architecture

```text
src/
├── main/       Electron lifecycle, IPC, and local services
├── preload/    Context-isolated renderer bridge
├── renderer/   React project workspace
└── shared/     Domain models and IPC contracts
```

The initial renderer uses representative project data so the product layout and domain boundaries can evolve independently from persistence and agent execution.

## Next Milestones

1. Add SQLite repositories for projects, sessions, agent runs, timeline entries, and handoff context.
2. Add `node-pty` agent runtimes and streaming IPC.
3. Connect native project selection, file browsing, and Git status/diff services.
4. Replace the representative renderer data with persisted project state.
