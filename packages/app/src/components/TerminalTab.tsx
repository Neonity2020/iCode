import "@xterm/xterm/css/xterm.css";
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
    let startupBuffer = "";
    let startupTimer: number | null = null;
    let startupDone = false;
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
        fontSize: 13,
        fontFamily:
          '"SF Mono", SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        lineHeight: 1.38,
        cursorBlink: true,
        screenReaderMode: false,
        scrollback: 4000,
        theme: {
          background: "#fbfbf8",
          foreground: "#2f2f2c",
          cursor: "#2f2f2c",
          cursorAccent: "#fbfbf8",
          selectionBackground: "rgba(146, 146, 146, 0.28)",
          selectionInactiveBackground: "rgba(146, 146, 146, 0.18)",
          black: "#2a2a27",
          red: "#b85c53",
          green: "#4e8c59",
          yellow: "#a47c2b",
          blue: "#4f74b8",
          magenta: "#8c63b8",
          cyan: "#4e8990",
          white: "#d7d7d1",
          brightBlack: "#6f6f68",
          brightRed: "#d06a61",
          brightGreen: "#6aa773",
          brightYellow: "#c99a45",
          brightBlue: "#6e8ed0",
          brightMagenta: "#a581d0",
          brightCyan: "#67aeb4",
          brightWhite: "#1f1f1d",
        },
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();
      session.terminal = terminal;
      session.fitAddon = fitAddon;

      const flushStartupBuffer = () => {
        if (startupDone || !startupBuffer) return;
        const filtered = startupBuffer
          .replace(
            /^The default interactive shell is now zsh\.[\s\S]*?support\.apple\.com\/kb\/HT208050\.\r?\n?/m,
            "",
          )
          .replace(/^\s*\r?\n+/, "");
        startupBuffer = "";
        startupDone = true;
        if (filtered) terminal.write(filtered);
      };

      const api = platform;
      const { id } = await api.ptySpawn({ cwd: tab.cwd, cols, rows });
      session.ptyId = id;
      session.unsubscribe = api.onPtyData(({ id: incomingId, data }) => {
        if (incomingId !== id) return;
        if (startupDone) {
          terminal.write(data);
          return;
        }
        startupBuffer += data;
        if (startupTimer !== null) window.clearTimeout(startupTimer);
        startupTimer = window.setTimeout(() => {
          startupTimer = null;
          flushStartupBuffer();
        }, 80);
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
      if (startupTimer !== null) window.clearTimeout(startupTimer);
      disposeTerminalTab(tab.id, platform);
    };
  }, [platform, tab.cwd, tab.id]);

  return (
    <section className="terminal-panel">
      <div className="terminal-surface">
        <div className="terminal-container" ref={containerRef} />
      </div>
    </section>
  );
}
