import { useEffect, useRef } from "react";
import type { ICodePlatformApi } from "@icode/platform";
import type { PtySession, RightSidebarTab } from "../domain/types";
import { usePlatform } from "../platform/PlatformContext";

export const ptySessions = new Map<string, PtySession>();

export function disposeTerminalTab(id: string, platform: ICodePlatformApi) {
  const session = ptySessions.get(id);
  if (!session) return;
  if (session.ptyId) void platform.ptyKill({ id: session.ptyId }).catch(() => {});
  session.unsubscribe();
  session.exitUnsub();
  session.terminal?.dispose();
  session.cleanupResize();
  ptySessions.delete(id);
}

export function TerminalTab({ tab }: { tab: RightSidebarTab }) {
  const platform = usePlatform();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const session: PtySession = {
      ptyId: "",
      unsubscribe: () => {},
      exitUnsub: () => {},
      terminal: null,
      fitAddon: null,
      cleanupResize: () => {},
    };
    ptySessions.set(tab.id, session);

    (async () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const cols = Math.max(2, Math.floor((rect?.width ?? 320) / 8));
      const rows = Math.max(2, Math.floor((rect?.height ?? 240) / 17));
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (cancelled || !containerRef.current) return;

      const terminal = new Terminal({
        fontSize: 12,
        cursorBlink: true,
        theme: { background: "#1c1c1a", foreground: "#e7e7e2" },
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();
      session.terminal = terminal;
      session.fitAddon = fitAddon;

      const api = platform;
      const { id } = await api.ptySpawn({ cwd: tab.cwd, cols, rows });
      session.ptyId = id;
      session.unsubscribe = api.onPtyData(({ id: incomingId, data }) => {
        if (incomingId === id) terminal.write(data);
      });
      session.exitUnsub = api.onPtyExit(({ id: incomingId }) => {
        if (incomingId === id) terminal.write("\r\n\x1b[31m[process exited]\x1b[0m\r\n");
      });
      terminal.onData((data) => void api.ptyWrite({ id, data }));

      const resizeObserver = new ResizeObserver(() => {
        if (!containerRef.current) return;
        fitAddon.fit();
        void api.ptyResize({ id, cols: terminal.cols, rows: terminal.rows });
      });
      resizeObserver.observe(containerRef.current);
      session.cleanupResize = () => resizeObserver.disconnect();
    })().catch((error: unknown) => {
      if (containerRef.current) {
        containerRef.current.textContent = `终端启动失败: ${String(
          error instanceof Error ? error.message : error,
        )}`;
      }
    });

    return () => {
      cancelled = true;
      disposeTerminalTab(tab.id, platform);
    };
  }, [platform, tab.cwd, tab.id]);

  return <div className="terminal-container" ref={containerRef} />;
}
