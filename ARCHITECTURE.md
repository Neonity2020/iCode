# iCode architecture

The renderer is organized by responsibility instead of by page size.

## Layers

- `src/domain/` — shared business types. No React and no side effects.
- `src/config/` — product constants and supported options.
- `src/lib/` — pure formatting and protocol helper functions.
- `src/state/` — persistence, normalization, and state migration.
- `src/hooks/` — stateful integrations and reusable interaction controllers.
- `src/components/` — focused UI components with explicit props.
- `src/App.tsx` — application composition and user commands.
- `electron/` — privileged desktop runtime and IPC boundary.

## Dependency direction

Components may depend on `domain`, `config`, and `lib`. Hooks may additionally
depend on `state`. Domain and library modules must never import components or
hooks. `App.tsx` is the composition root and is the only renderer module that
should coordinate several features at once.

## Feature ownership

- Codex notifications and request routing: `hooks/useCodexEvents.ts`
- Session persistence and backward-compatible normalization:
  `state/persistence.ts`
- Panel resizing and animation-frame batching: `hooks/usePanelResize.ts`
- Conversation rendering: `components/ConversationView.tsx`
- Activity bundle behavior: `components/ActivityBundle.tsx`
- Right sidebar tabs: `components/RightSidebar.tsx`
- Filesystem tree: `components/FileTreeTab.tsx`
- PTY lifecycle: `components/TerminalTab.tsx`

## Change guidelines

1. Add protocol data shapes to `domain/types.ts`.
2. Keep protocol-to-view translations in `lib/` or the owning hook.
3. Keep components unaware of local storage, IPC event routing, and sibling
   component state.
4. Add new right-sidebar tools through `RightSidebarTabKind` and
   `RightSidebar`, without adding branches to the conversation UI.
5. Normalize persisted data at the state boundary so UI components can rely on
   valid types.

Run `pnpm check` and `pnpm build` after structural changes.
