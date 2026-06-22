# iCode

A focused desktop workspace for coding with agents. The UI borrows OpenWork's calm, task-first layout while keeping the runtime intentionally small.

## Stack

- Electron 40
- React 19
- Vite 8
- Vite+ 0.2
- TypeScript 6

## Development

Vite+ manages the required Node version and delegates dependency installation to pnpm.

```bash
vp install
vp run dev
```

Run checks and create the renderer build:

```bash
vp check
vp build
```

The current app is an interactive desktop shell. Agent runtime and OpenCode SDK integration are deliberately kept out of this first scaffold.
