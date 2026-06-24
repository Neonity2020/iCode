# iCode architecture

## Monorepo boundaries

```text
apps/desktop ─┐
              ├──> packages/app ───> packages/platform
apps/web ─────┘
```

- `apps/desktop` owns Electron, native process lifecycle, IPC, filesystem, and PTY access.
- `apps/web` owns browser bootstrap and the future remote service adapter.
- `packages/app` owns the product UI, state, hooks, and cross-platform behavior.
- `packages/platform` owns the contract between product code and a host environment.

Apps may import packages. Packages must never import an app.

## Shared application layers

Inside `packages/app/src`:

- `domain/` contains business types with no React or side effects.
- `config/` contains product constants and supported options.
- `lib/` contains pure formatting and protocol helpers.
- `state/` contains persistence, normalization, and migration.
- `hooks/` contains stateful integrations and interaction controllers.
- `components/` contains focused UI components.
- `platform/` contains the React context for the injected host API.
- `App.tsx` is the shared composition root.

Components may depend on `domain`, `config`, `lib`, and the platform context. Hooks may also
depend on `state`. Domain and library modules must not import components or hooks.

## Platform contract

`@icode/platform` exposes one `ICodePlatformApi` contract. Capability flags describe whether a
host supports local workspace selection, filesystem access, and terminals.

- Desktop satisfies the contract through `apps/desktop/electron/preload.cjs`.
- Web satisfies the same contract through `apps/web/src/platform.ts`.

Platform-specific behavior should be added to an app adapter first. Shared product code should
only change when the behavior is genuinely common to both applications.

## Feature ownership

- Codex notifications and request routing: `packages/app/src/hooks/useCodexEvents.ts`
- Session persistence and normalization: `packages/app/src/state/persistence.ts`
- Panel resizing: `packages/app/src/hooks/usePanelResize.ts`
- Conversation UI: `packages/app/src/components/ConversationView.tsx`
- Filesystem tree: `packages/app/src/components/FileTreeTab.tsx`
- PTY lifecycle: `packages/app/src/components/TerminalTab.tsx`
- Desktop Codex process: `apps/desktop/electron/main.mjs`
- Web service adapter: `apps/web/src/platform.ts`

Run `pnpm check` and `pnpm build` after structural changes.
