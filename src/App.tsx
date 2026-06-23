import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  File,
  FileCode2,
  Folder,
  FolderOpen,
  FolderTree,
  GitBranch,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Square,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";

type Message = { id: string; role: "user" | "assistant"; content: string };
type Activity = { id: string; title: string; detail: string; status: string };
type Approval = { id: string | number; method: string; params: Record<string, unknown> };
type ActiveTurn = { threadId: string; turnId: string };
type FileChangeKind = "add" | "modify" | "delete";
type FileChange = {
  id: string;
  path: string;
  kind: FileChangeKind;
  diff: string;
  status: "inProgress" | "completed" | "failed";
};
type Conversation = {
  messages: Message[];
  activities: Activity[];
  approvals: Approval[];
  fileChanges: FileChange[];
  activeTurn: ActiveTurn | null;
  error: string | null;
};
type Session = {
  id: number;
  title: string;
  detail: string;
  time: string;
  threadId?: string;
  conversation: Conversation;
};
type RuntimeStatus = {
  state: "starting" | "ready" | "error";
  version: string | null;
  error: string | null;
  launchId: string | null;
};
type ModelId = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini";
type CodexItem = Record<string, unknown> & { id?: string; type?: string; status?: string };
type StoredState = {
  appRunId: string | null;
  workspacePath: string;
  sidebarOpen: boolean;
  rightSidebarOpen: boolean;
  selectedModel: ModelId;
  activeSessionId: number;
  sessions: Session[];
  tabs: StoredRightSidebarTab[];
  activeTabId: string;
  expandedDirs: string[];
};

type RightSidebarTabKind = "files" | "terminal" | "tree";
type RightSidebarTab = {
  id: string;
  kind: RightSidebarTabKind;
  title: string;
  cwd?: string;
};
// Only tabs that survive a restart. Terminal tabs hold a live pty and are
// recreated on demand, so they are intentionally excluded from persistence.
type StoredRightSidebarTab = {
  id: string;
  kind: "files" | "tree";
  title: string;
  cwd?: string;
};
type PtySession = {
  ptyId: string;
  unsubscribe: () => void;
  exitUnsub: () => void;
  terminal: {
    dispose: () => void;
    write: (data: string) => void;
    onData: (cb: (data: string) => void) => void;
    cols: number;
    rows: number;
  } | null;
  fitAddon: { fit: () => void } | null;
  cleanupResize: () => void;
};
type DirNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: DirNode[];
};

const STORAGE_KEY = "icode.conversations.v1";
const DEFAULT_MODEL: ModelId = "gpt-5.5";
const MODEL_OPTIONS: { id: ModelId; label: string; detail: string }[] = [
  { id: "gpt-5.5", label: "GPT-5.5", detail: "复杂任务" },
  { id: "gpt-5.4", label: "GPT-5.4", detail: "均衡" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", detail: "更快" },
];

function compactPath(value: string) {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? value;
}

function stringifyDetail(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyDetail).filter(Boolean).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function normalizeModel(value: unknown): ModelId {
  return MODEL_OPTIONS.some((option) => option.id === value) ? (value as ModelId) : DEFAULT_MODEL;
}

// Drop terminal tabs (live pty cannot be restored) and ensure there is always a
// "files" tab. Duplicates of the fixed "files" id are collapsed.
function normalizeStoredTabs(raw: unknown, _activeTabId: unknown): StoredRightSidebarTab[] {
  if (!Array.isArray(raw)) return defaultTabs();
  const seen = new Set<string>();
  const tabs: StoredRightSidebarTab[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const kind = item.kind === "tree" ? "tree" : "files";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    tabs.push({
      id,
      kind,
      title: typeof item.title === "string" ? item.title : kind === "tree" ? "文件树" : "文件变更",
      cwd: typeof item.cwd === "string" && item.cwd ? item.cwd : undefined,
    });
  }
  if (!tabs.some((t) => t.id === "files" && t.kind === "files")) {
    tabs.unshift({ id: "files", kind: "files", title: "文件变更" });
  }
  return tabs.length > 0 ? tabs : defaultTabs();
}

function normalizeExpandedDirs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string" || !entry || seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

function emptyConversation(): Conversation {
  return {
    messages: [],
    activities: [],
    approvals: [],
    fileChanges: [],
    activeTurn: null,
    error: null,
  };
}

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? Date.now(),
    title: overrides.title ?? "新任务",
    detail: overrides.detail ?? "描述你想完成的工作",
    time: overrides.time ?? "刚刚",
    threadId: typeof overrides.threadId === "string" ? overrides.threadId : undefined,
    conversation: overrides.conversation ?? emptyConversation(),
  };
}

function normalizeConversation(raw: unknown): Conversation {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const messages = Array.isArray(source.messages)
    ? source.messages
        .map((message) => {
          if (!message || typeof message !== "object") return null;
          const item = message as Record<string, unknown>;
          if (typeof item.id !== "string") return null;
          if (item.role !== "user" && item.role !== "assistant") return null;
          return {
            id: item.id,
            role: item.role,
            content: typeof item.content === "string" ? item.content : "",
          } satisfies Message;
        })
        .filter(Boolean)
    : [];

  const activities = Array.isArray(source.activities)
    ? source.activities
        .map((activity) => {
          if (!activity || typeof activity !== "object") return null;
          const item = activity as Record<string, unknown>;
          if (typeof item.id !== "string") return null;
          return {
            id: item.id,
            title: typeof item.title === "string" ? item.title : "Codex 活动",
            detail: typeof item.detail === "string" ? item.detail : "",
            status: typeof item.status === "string" ? item.status : "completed",
          } satisfies Activity;
        })
        .filter(Boolean)
    : [];

  const approvals = Array.isArray(source.approvals)
    ? source.approvals
        .map((approval) => {
          if (!approval || typeof approval !== "object") return null;
          const item = approval as Record<string, unknown>;
          if (typeof item.method !== "string") return null;
          if (typeof item.id !== "string" && typeof item.id !== "number") return null;
          return {
            id: item.id,
            method: item.method,
            params:
              item.params && typeof item.params === "object"
                ? (item.params as Record<string, unknown>)
                : {},
          } satisfies Approval;
        })
        .filter(Boolean)
    : [];

  const fileChanges = Array.isArray(source.fileChanges)
    ? source.fileChanges
        .map((change) => {
          if (!change || typeof change !== "object") return null;
          const item = change as Record<string, unknown>;
          if (typeof item.id !== "string") return null;
          const kindRaw = typeof item.kind === "string" ? item.kind : "modify";
          const kind: FileChangeKind =
            kindRaw === "add" || kindRaw === "modify" || kindRaw === "delete" ? kindRaw : "modify";
          const statusRaw = typeof item.status === "string" ? item.status : "completed";
          const status =
            statusRaw === "inProgress" || statusRaw === "completed" || statusRaw === "failed"
              ? statusRaw
              : "completed";
          return {
            id: item.id,
            path: typeof item.path === "string" ? item.path : "",
            kind,
            diff: typeof item.diff === "string" ? item.diff : "",
            status,
          } satisfies FileChange;
        })
        .filter(Boolean)
    : [];

  const activeTurn =
    source.activeTurn && typeof source.activeTurn === "object"
      ? {
          threadId:
            typeof (source.activeTurn as Record<string, unknown>).threadId === "string"
              ? String((source.activeTurn as Record<string, unknown>).threadId)
              : "",
          turnId:
            typeof (source.activeTurn as Record<string, unknown>).turnId === "string"
              ? String((source.activeTurn as Record<string, unknown>).turnId)
              : "",
        }
      : null;

  return {
    messages,
    activities,
    approvals,
    fileChanges,
    activeTurn: activeTurn && activeTurn.threadId && activeTurn.turnId ? activeTurn : null,
    error: typeof source.error === "string" ? source.error : null,
  };
}

function normalizeSession(raw: unknown): Session | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const id = Number(source.id);
  if (!Number.isFinite(id)) return null;

  return buildSession({
    id,
    title: typeof source.title === "string" ? source.title : undefined,
    detail: typeof source.detail === "string" ? source.detail : undefined,
    time: typeof source.time === "string" ? source.time : undefined,
    threadId: typeof source.threadId === "string" ? source.threadId : undefined,
    conversation: normalizeConversation(source.conversation ?? source),
  });
}

function defaultTabs() {
  return [{ id: "files", kind: "files", title: "文件变更" } as StoredRightSidebarTab];
}

function loadStoredState(): StoredState {
  const fallbackSession = buildSession();
  const fallback = {
    appRunId: null,
    workspacePath: "",
    sidebarOpen: true,
    rightSidebarOpen: true,
    selectedModel: DEFAULT_MODEL,
    activeSessionId: fallbackSession.id,
    sessions: [fallbackSession],
    tabs: defaultTabs(),
    activeTabId: "files",
  };
  if (typeof window === "undefined") return fallback;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions.map(normalizeSession).filter(Boolean)
      : [];
    const normalizedSessions = sessions.length > 0 ? (sessions as Session[]) : [fallbackSession];
    const activeSessionId = normalizedSessions.some(
      (session) => session.id === parsed.activeSessionId,
    )
      ? Number(parsed.activeSessionId)
      : normalizedSessions[0].id;

    const tabs = normalizeStoredTabs(parsed.tabs, parsed.activeTabId);
    const activeTabId = tabs.some((t) => t.id === parsed.activeTabId)
      ? String(parsed.activeTabId)
      : tabs[0].id;

    return {
      appRunId: typeof parsed.appRunId === "string" ? parsed.appRunId : null,
      workspacePath: typeof parsed.workspacePath === "string" ? parsed.workspacePath : "",
      sidebarOpen: typeof parsed.sidebarOpen === "boolean" ? parsed.sidebarOpen : true,
      rightSidebarOpen:
        typeof parsed.rightSidebarOpen === "boolean" ? parsed.rightSidebarOpen : true,
      selectedModel: normalizeModel(parsed.selectedModel),
      activeSessionId,
      sessions: normalizedSessions,
      tabs,
      activeTabId,
      expandedDirs: normalizeExpandedDirs(parsed.expandedDirs),
    };
  } catch {
    return fallback;
  }
}

function resetSessionForNewLaunch(session: Session): Session {
  return {
    ...session,
    conversation: {
      ...session.conversation,
      activeTurn: null,
      approvals: [],
      error: null,
      activities: session.conversation.activities.map((activity) =>
        activity.status === "inProgress" ? { ...activity, status: "completed" } : activity,
      ),
      fileChanges: session.conversation.fileChanges.map((change) =>
        change.status === "inProgress" ? { ...change, status: "completed" } : change,
      ),
    },
  };
}

function describeItem(item: CodexItem): Omit<Activity, "id" | "status"> {
  switch (item.type) {
    case "commandExecution":
      return { title: "运行命令", detail: stringifyDetail(item.command) };
    case "fileChange":
      return { title: "修改文件", detail: stringifyDetail(item.changes) };
    case "mcpToolCall":
      return { title: `调用 ${String(item.server ?? "MCP")}`, detail: String(item.tool ?? "工具") };
    case "dynamicToolCall":
      return { title: "调用工具", detail: String(item.tool ?? "") };
    case "webSearch":
      return { title: "搜索网页", detail: String(item.query ?? "") };
    case "reasoning":
      return { title: "分析任务", detail: "Codex 正在推理" };
    case "plan":
      return { title: "更新计划", detail: String(item.text ?? "") };
    default:
      return { title: "Codex 活动", detail: String(item.type ?? "处理中") };
  }
}

function approvalCopy(approval: Approval) {
  if (approval.method === "item/commandExecution/requestApproval") {
    return { title: "允许运行命令？", detail: stringifyDetail(approval.params.command) };
  }
  if (approval.method === "item/fileChange/requestApproval") {
    return {
      title: "允许修改文件？",
      detail: String(approval.params.reason ?? "Codex 请求写入工作区"),
    };
  }
  return { title: "Codex 需要确认", detail: String(approval.params.reason ?? approval.method) };
}

function TerminalTab({ tab }: { tab: RightSidebarTab }) {
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
    ptySessionsRef_global.set(tab.id, session);
    (async () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const cols = Math.max(2, Math.floor((rect?.width ?? 320) / 8));
      const rows = Math.max(2, Math.floor((rect?.height ?? 240) / 17));
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (cancelled || !containerRef.current) return;
      const term = new Terminal({
        fontSize: 12,
        cursorBlink: true,
        theme: { background: "#1c1c1a", foreground: "#e7e7e2" },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      fit.fit();
      session.terminal = term;
      session.fitAddon = fit;
      const api = window.icode;
      if (!api) return;
      const { id } = await api.ptySpawn({ cwd: tab.cwd, cols, rows });
      session.ptyId = id;
      session.unsubscribe = api.onPtyData(({ id: pid, data }) => {
        if (pid === id) term.write(data);
      });
      session.exitUnsub = api.onPtyExit(({ id: pid }) => {
        if (pid === id) term.write("\r\n\x1b[31m[process exited]\x1b[0m\r\n");
      });
      term.onData((data) => void api.ptyWrite({ id, data }));
      const ro = new ResizeObserver(() => {
        const r = containerRef.current?.getBoundingClientRect();
        if (!r) return;
        fit.fit();
        void api.ptyResize({ id, cols: term.cols, rows: term.rows });
      });
      ro.observe(containerRef.current);
      session.cleanupResize = () => ro.disconnect();
    })().catch((err: unknown) => {
      if (containerRef.current) {
        containerRef.current.textContent = `终端启动失败: ${String(
          err instanceof Error ? err.message : err,
        )}`;
      }
    });
    return () => {
      cancelled = true;
      const s = ptySessionsRef_global.get(tab.id);
      if (s) {
        if (s.ptyId) void window.icode?.ptyKill({ id: s.ptyId }).catch(() => {});
        s.unsubscribe();
        s.exitUnsub();
        s.terminal?.dispose();
        s.cleanupResize();
        ptySessionsRef_global.delete(tab.id);
      }
    };
  }, [tab.id, tab.cwd]);
  return <div className="terminal-container" ref={containerRef} />;
}

type TreeState = {
  loading: boolean;
  root: string;
  truncated: boolean;
  nodes: DirNode[];
  expanded: Set<string>;
  error: string | null;
};
type TreeMenuState = { path: string; x: number; y: number; kind: "file" | "dir" };

function FileTreeTab({
  tab,
  expandedDirs,
  onToggleExpand,
}: {
  tab: RightSidebarTab;
  expandedDirs: string[];
  onToggleExpand: (path: string, open: boolean) => void;
}) {
  const restoredExpanded = useMemo(
    () => new Set(expandedDirs),
    // expandedDirs is identity-stable (only changes via setState), so the Set is
    // rebuilt only when its contents actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expandedDirs],
  );
  const [state, setState] = useState<TreeState>({
    loading: true,
    root: tab.cwd ?? "",
    truncated: false,
    nodes: [],
    expanded: restoredExpanded,
    error: null,
  });
  const [menu, setMenu] = useState<TreeMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: null }));
    window.icode?.listFs({ path: tab.cwd }).then(
      (res) => {
        const next = new Set(restoredExpanded);
        next.add(res.root);
        setState({
          loading: false,
          root: res.root,
          truncated: res.truncated,
          nodes: res.children,
          expanded: next,
          error: null,
        });
      },
      (err: unknown) =>
        setState((current) => ({
          ...current,
          loading: false,
          error: String(err instanceof Error ? err.message : err),
        })),
    );
  }, [tab.cwd, restoredExpanded]);
  useEffect(() => {
    reload();
  }, [reload]);

  // Keep local expanded set in sync when the persisted set changes externally.
  useEffect(() => {
    setState((current) => ({ ...current, expanded: restoredExpanded }));
  }, [restoredExpanded]);

  // Close menu on outside interaction or scroll.
  useEffect(() => {
    if (!menu) return;
    const handlePointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const close = () => setMenu(null);
    document.addEventListener("mousedown", handlePointer);
    paneRef.current?.addEventListener("scroll", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      paneRef.current?.removeEventListener("scroll", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  // Clamp the menu inside the viewport so it never overflows the window.
  useLayoutEffect(() => {
    if (!menu) return;
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x = Math.max(4, Math.min(menu.x, vw - rect.width - 4));
    const y = Math.max(4, Math.min(menu.y, vh - rect.height - 4));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [menu]);

  const toggle = useCallback(
    (path: string) => {
      let nowOpen = false;
      setState((current) => {
        const next = new Set(current.expanded);
        if (next.has(path)) {
          next.delete(path);
          nowOpen = false;
        } else {
          next.add(path);
          nowOpen = true;
        }
        return { ...current, expanded: next };
      });
      onToggleExpand(path, nowOpen);
    },
    [onToggleExpand],
  );

  const openContextMenu = useCallback((event: ReactMouseEvent, node: DirNode) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ path: node.path, x: event.clientX, y: event.clientY, kind: node.type });
  }, []);

  const revealInFinder = useCallback(async (target: TreeMenuState) => {
    setMenu(null);
    await window.icode?.revealInFinder(target.path);
  }, []);

  return (
    <div className="tree-pane" ref={paneRef}>
      <div className="tree-toolbar">
        <span className="tree-root" title={state.root}>
          {compactPath(state.root) || "/"}
        </span>
        <button className="icon-button" type="button" onClick={reload} aria-label="刷新">
          <RefreshCw size={13} />
        </button>
      </div>
      {state.error && <div className="file-empty">{state.error}</div>}
      {state.loading && <div className="file-empty">加载中…</div>}
      {!state.loading && !state.error && (
        <div className="tree-list">
          {state.nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              state={state}
              onToggle={toggle}
              onContextMenu={openContextMenu}
            />
          ))}
        </div>
      )}
      {state.truncated && <div className="file-empty">条目过多，已截断显示</div>}
      {menu && (
        <div className="tree-menu" ref={menuRef} role="menu" style={{ left: menu.x, top: menu.y }}>
          <button
            type="button"
            role="menuitem"
            className="tree-menu-item"
            onClick={() => void revealInFinder(menu)}
          >
            <FolderOpen size={13} />
            <span>在 Finder 中显示</span>
          </button>
        </div>
      )}
    </div>
  );
}

function TreeNode({
  node,
  state,
  onToggle,
  onContextMenu,
}: {
  node: DirNode;
  state: TreeState;
  onToggle: (path: string) => void;
  onContextMenu: (event: ReactMouseEvent, node: DirNode) => void;
}) {
  const open = state.expanded.has(node.path);
  if (node.type === "file") {
    return (
      <div
        className="tree-node tree-file"
        onContextMenu={(event) => onContextMenu(event, node)}
        title={node.path}
      >
        <span className="tree-indent" />
        <FileCode2 size={12} className="tree-icon" />
        <span className="tree-name">{node.name}</span>
      </div>
    );
  }
  return (
    <>
      <div
        className="tree-node tree-dir"
        onContextMenu={(event) => onContextMenu(event, node)}
        title={node.path}
      >
        <button
          type="button"
          className="tree-toggle"
          onClick={() => onToggle(node.path)}
          aria-expanded={open}
        >
          <ChevronRight size={11} className={`tree-chevron ${open ? "open" : ""}`} />
          <Folder size={12} className="tree-icon" />
          <span className="tree-name">{node.name}</span>
        </button>
      </div>
      {open &&
        node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            state={state}
            onToggle={onToggle}
            onContextMenu={onContextMenu}
          />
        ))}
    </>
  );
}

const ptySessionsRef_global: Map<string, PtySession> = new Map();

export function App() {
  const [appState, setAppState] = useState<StoredState>(() => loadStoredState());
  const [runtime, setRuntime] = useState<RuntimeStatus>({
    state: "starting",
    version: null,
    error: null,
    launchId: null,
  });
  const [composer, setComposer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const [tabs, setTabs] = useState<RightSidebarTab[]>(() => appState.tabs.map((t) => ({ ...t })));
  const [activeTabId, setActiveTabId] = useState<string>(appState.activeTabId);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  // Persisted expanded directories across all file-tree tabs. A single global
  // set is fine: entries are absolute paths, and restoring a tab simply reopens
  // whichever of these paths still exist beneath its root.
  const [expandedDirs, setExpandedDirs] = useState<string[]>(appState.expandedDirs);
  const ptySessionsRef = useRef(ptySessionsRef_global);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const conversationRef = useRef<HTMLElement>(null);
  const sendingRef = useRef(false);
  const recentEventsRef = useRef(new Map<string, number>());
  const appStateRef = useRef(appState);
  const runningTurnRef = useRef<{ sessionId: number; threadId: string; turnId: string } | null>(
    null,
  );
  const threadSessionMapRef = useRef(new Map<string, number>());

  const currentSession =
    appState.sessions.find((session) => session.id === appState.activeSessionId) ??
    appState.sessions[0];
  const messages = currentSession?.conversation.messages ?? [];
  const activities = currentSession?.conversation.activities ?? [];
  const approvals = currentSession?.conversation.approvals ?? [];
  const fileChanges = currentSession?.conversation.fileChanges ?? [];
  const activeTurnSession = appState.sessions.find((session) => session.conversation.activeTurn);
  const activeTurn = activeTurnSession?.conversation.activeTurn ?? null;
  const currentSessionActiveTurn = currentSession?.conversation.activeTurn ?? null;
  const rightSidebarOpen = appState.rightSidebarOpen;
  const completedFileChangeCount = fileChanges.filter((f) => f.status === "completed").length;
  const workspacePath = appState.workspacePath;
  const sidebarOpen = appState.sidebarOpen;
  const activeTitle = currentSession?.title ?? "新任务";
  const selectedModel = appState.selectedModel;
  const selectedModelOption =
    MODEL_OPTIONS.find((option) => option.id === selectedModel) ?? MODEL_OPTIONS[0];

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!modelPickerRef.current?.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [modelMenuOpen]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [addMenuOpen]);

  useEffect(() => {
    const map = new Map<string, number>();
    for (const session of appState.sessions) {
      if (session.threadId) map.set(session.threadId, session.id);
    }
    threadSessionMapRef.current = map;
  }, [appState.sessions]);

  useEffect(() => {
    void window.icode?.getState().then((state) => {
      setAppState((current) => ({
        ...current,
        workspacePath: state.workspace,
      }));
      setRuntime({ ...state.codex, launchId: state.launchId });
      setAppState((current) => {
        if (current.appRunId === state.launchId) return current;
        return {
          ...current,
          appRunId: state.launchId,
          sessions: current.sessions.map(resetSessionForNewLaunch),
        };
      });
    });

    return window.icode?.onCodexEvent((event) => {
      const eventKey = JSON.stringify(event);
      const now = performance.now();
      const previousSeenAt = recentEventsRef.current.get(eventKey);
      if (previousSeenAt && now - previousSeenAt < 50) return;
      recentEventsRef.current.set(eventKey, now);
      for (const [key, seenAt] of recentEventsRef.current) {
        if (now - seenAt > 1_000) recentEventsRef.current.delete(key);
      }

      const getTargetSessionId = (threadId?: string) => {
        if (threadId && threadSessionMapRef.current.has(threadId)) {
          return threadSessionMapRef.current.get(threadId) ?? appStateRef.current.activeSessionId;
        }
        if (runningTurnRef.current) return runningTurnRef.current.sessionId;
        return appStateRef.current.activeSessionId;
      };

      if (event.type === "status") {
        setRuntime((current) => ({ ...event.status, launchId: current.launchId }));
        return;
      }
      if (event.type === "request") {
        const threadId =
          typeof event.request.params === "object" &&
          event.request.params &&
          typeof (event.request.params as Record<string, unknown>).threadId === "string"
            ? String((event.request.params as Record<string, unknown>).threadId)
            : undefined;
        const sessionId = getTargetSessionId(threadId);
        const request = {
          ...event.request,
          params:
            event.request.params && typeof event.request.params === "object"
              ? (event.request.params as Record<string, unknown>)
              : {},
        } as Approval;
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  conversation: {
                    ...session.conversation,
                    approvals: [...session.conversation.approvals, request],
                  },
                }
              : session,
          ),
        }));
        return;
      }
      if (event.type !== "notification") return;

      const params = event.params ?? {};
      if (event.method === "turn/started") {
        const turn = params.turn as { id?: string } | undefined;
        if (typeof params.threadId === "string" && turn?.id) {
          const sessionId = getTargetSessionId(String(params.threadId));
          runningTurnRef.current = {
            sessionId,
            threadId: String(params.threadId),
            turnId: String(turn.id),
          };
          setAppState((current) => ({
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    threadId: String(params.threadId),
                    conversation: {
                      ...session.conversation,
                      activeTurn: {
                        threadId: String(params.threadId),
                        turnId: String(turn.id),
                      },
                      error: null,
                    },
                  }
                : session,
            ),
          }));
          threadSessionMapRef.current.set(String(params.threadId), sessionId);
        }
      } else if (event.method === "turn/completed") {
        const sessionId =
          runningTurnRef.current?.sessionId ??
          (typeof params.threadId === "string"
            ? getTargetSessionId(String(params.threadId))
            : null);
        if (sessionId) {
          setAppState((current) => ({
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    conversation: {
                      ...session.conversation,
                      activeTurn: null,
                    },
                  }
                : session,
            ),
          }));
        }
        sendingRef.current = false;
        runningTurnRef.current = null;
      } else if (event.method === "item/agentMessage/delta") {
        const sessionId = runningTurnRef.current?.sessionId ?? getTargetSessionId();
        const itemId = String(params.itemId);
        const delta = String(params.delta ?? "");
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  conversation: {
                    ...session.conversation,
                    messages: (() => {
                      const found = session.conversation.messages.findIndex(
                        (message) => message.id === itemId,
                      );
                      if (found < 0) {
                        return [
                          ...session.conversation.messages,
                          { id: itemId, role: "assistant", content: delta },
                        ];
                      }
                      return session.conversation.messages.map((message, index) =>
                        index === found
                          ? { ...message, content: message.content + delta }
                          : message,
                      );
                    })(),
                  },
                }
              : session,
          ),
        }));
      } else if (event.method === "item/started" || event.method === "item/completed") {
        const item = params.item as CodexItem | undefined;
        if (!item?.id || item.type === "userMessage") return;
        const sessionId = runningTurnRef.current?.sessionId ?? getTargetSessionId();
        if (item.type === "agentMessage") {
          const text = String(item.text ?? "");
          setAppState((current) => ({
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    conversation: {
                      ...session.conversation,
                      messages: (() => {
                        const exists = session.conversation.messages.some(
                          (message) => message.id === item.id,
                        );
                        return exists
                          ? session.conversation.messages.map((message) =>
                              message.id === item.id ? { ...message, content: text } : message,
                            )
                          : [
                              ...session.conversation.messages,
                              { id: item.id, role: "assistant", content: text },
                            ];
                      })(),
                    },
                  }
                : session,
            ),
          }));
          return;
        }
        if (item.type === "fileChange") {
          const rawChanges =
            (item.changes && typeof item.changes === "object"
              ? (item.changes as Record<string, unknown>)
              : {}) ?? {};
          const path = typeof rawChanges.path === "string" ? rawChanges.path : "";
          const kindRaw = typeof rawChanges.kind === "string" ? rawChanges.kind : "modify";
          const kind: FileChangeKind =
            kindRaw === "add" || kindRaw === "modify" || kindRaw === "delete" ? kindRaw : "modify";
          const diff = typeof rawChanges.diff === "string" ? rawChanges.diff : "";
          const statusRaw = String(item.status ?? "completed");
          const status: FileChange["status"] =
            event.method === "item/completed"
              ? statusRaw === "failed"
                ? "failed"
                : "completed"
              : "inProgress";
          const entry: FileChange = { id: String(item.id), path, kind, diff, status };
          setAppState((current) => ({
            ...current,
            sessions: current.sessions.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    conversation: {
                      ...session.conversation,
                      fileChanges: session.conversation.fileChanges.some((f) => f.id === item.id)
                        ? session.conversation.fileChanges.map((f) =>
                            f.id === item.id ? entry : f,
                          )
                        : [...session.conversation.fileChanges, entry],
                    },
                  }
                : session,
            ),
          }));
          return;
        }
        const copy = describeItem(item);
        const status =
          event.method === "item/completed" ? String(item.status ?? "completed") : "inProgress";
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  conversation: {
                    ...session.conversation,
                    activities: (() => {
                      const activity = { id: String(item.id), ...copy, status };
                      const found = session.conversation.activities.some(
                        (entry) => entry.id === item.id,
                      );
                      return found
                        ? session.conversation.activities.map((entry) =>
                            entry.id === item.id ? activity : entry,
                          )
                        : [...session.conversation.activities, activity];
                    })(),
                  },
                }
              : session,
          ),
        }));
      } else if (event.method === "error") {
        const sessionId = runningTurnRef.current?.sessionId ?? getTargetSessionId();
        sendingRef.current = false;
        runningTurnRef.current = null;
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  conversation: {
                    ...session.conversation,
                    error: String(
                      (params.error as { message?: string } | undefined)?.message ??
                        params.message ??
                        "Codex 运行失败",
                    ),
                    activeTurn: null,
                  },
                }
              : session,
          ),
        }));
      }
    });
  }, []);

  useEffect(() => {
    const element = conversationRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, activities, approvals, error]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        const persistTabs: StoredRightSidebarTab[] = tabs
          .filter((t) => t.kind !== "terminal")
          .map((t) => ({ id: t.id, kind: t.kind, title: t.title, cwd: t.cwd }));
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ...appState,
            appRunId: runtime.launchId ?? appState.appRunId,
            tabs: persistTabs,
            activeTabId,
            expandedDirs,
          }),
        );
      } catch {
        // Ignore storage failures; the UI still works in memory.
      }
    }, 120);

    return () => window.clearTimeout(handle);
  }, [appState, runtime.launchId, tabs, activeTabId, expandedDirs]);

  const handleToggleExpand = useCallback((path: string, open: boolean) => {
    setExpandedDirs((current) => {
      const set = new Set(current);
      if (open) set.add(path);
      else set.delete(path);
      return [...set];
    });
  }, []);

  async function chooseWorkspace() {
    const directory = await window.icode?.pickDirectory();
    if (!directory) return;
    setAppState((current) => ({
      ...current,
      workspacePath: directory,
    }));
    createNewSession();
  }

  function createNewSession() {
    const id = Date.now();
    setAppState((current) => ({
      ...current,
      activeSessionId: id,
      sessions: [
        buildSession({ id, title: "新任务", detail: "描述你想完成的工作", time: "刚刚" }),
        ...current.sessions,
      ],
    }));
    setComposer("");
  }

  function deleteSession(sessionId: number) {
    setAppState((current) => {
      const remaining = current.sessions.filter((session) => session.id !== sessionId);
      const fallback = buildSession();
      const sessions = remaining.length > 0 ? remaining : [fallback];
      const activeSessionId =
        sessions.find((session) => session.id === current.activeSessionId)?.id ?? sessions[0].id;
      if (activeSessionId === sessions[0].id && current.activeSessionId !== activeSessionId) {
        setComposer("");
      }
      return { ...current, sessions, activeSessionId };
    });
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = composer.trim();
    if (!content || sendingRef.current || runtime.state !== "ready") return;
    if (currentSessionActiveTurn) return;
    const sessionId = appState.activeSessionId;
    const userMessageId = `user-${Date.now()}`;
    sendingRef.current = true;
    setComposer("");
    setError(null);

    setAppState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: session.title === "新任务" ? content.slice(0, 24) : session.title,
              detail: content.slice(0, 36),
              time: "刚刚",
              conversation: {
                ...session.conversation,
                messages: [
                  ...session.conversation.messages,
                  { id: userMessageId, role: "user", content },
                ],
                error: null,
              },
            }
          : session,
      ),
    }));

    try {
      let threadId = currentSession?.threadId;
      if (!threadId) {
        const result = await window.icode?.startThread({ model: selectedModel });
        threadId = result?.thread.id;
        if (!threadId) throw new Error("Codex 未返回 thread id");
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId ? { ...session, threadId } : session,
          ),
        }));
        threadSessionMapRef.current.set(threadId, sessionId);
      }
      const result = await window.icode?.sendTurn({
        threadId,
        text: content,
        model: selectedModel,
      });
      if (result?.turn.id) {
        runningTurnRef.current = { sessionId, threadId, turnId: result.turn.id };
        setAppState((current) => ({
          ...current,
          sessions: current.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  conversation: {
                    ...session.conversation,
                    activeTurn: { threadId, turnId: result.turn.id },
                  },
                }
              : session,
          ),
        }));
      }
    } catch (caught) {
      sendingRef.current = false;
      runningTurnRef.current = null;
      const message = caught instanceof Error ? caught.message : String(caught);
      setAppState((current) => ({
        ...current,
        sessions: current.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                conversation: {
                  ...session.conversation,
                  messages: session.conversation.messages.filter((msg) => msg.id !== userMessageId),
                  activeTurn: null,
                  error: message,
                },
              }
            : session,
        ),
      }));
    }
  }

  async function answerApproval(approval: Approval, decision: "accept" | "decline") {
    await window.icode?.respondToCodex({ id: approval.id, result: { decision } });
    const sessionId = runningTurnRef.current?.sessionId ?? appState.activeSessionId;
    setAppState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              conversation: {
                ...session.conversation,
                approvals: session.conversation.approvals.filter((item) => item.id !== approval.id),
              },
            }
          : session,
      ),
    }));
  }

  async function interrupt() {
    if (!activeTurn) return;
    await window.icode?.interruptTurn(activeTurn);
    sendingRef.current = false;
    runningTurnRef.current = null;
    setAppState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === activeTurnSession?.id
          ? {
              ...session,
              conversation: {
                ...session.conversation,
                activeTurn: null,
              },
            }
          : session,
      ),
    }));
  }

  const runtimeLabel = useMemo(() => {
    if (runtime.state === "ready") return "Codex 已连接";
    if (runtime.state === "error") return "Codex 连接失败";
    return "正在连接 Codex";
  }, [runtime.state]);

  return (
    <div
      className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"} ${
        rightSidebarOpen ? "" : "right-collapsed"
      }`}
    >
      <aside className="sidebar">
        <div className="traffic-light-space" />
        <div className="workspace-row">
          <button className="workspace-button" type="button" onClick={chooseWorkspace}>
            <span className="workspace-icon">
              <Code2 size={15} />
            </span>
            <span>{compactPath(workspacePath) || "选择工作区"}</span>
            <ChevronDown size={14} />
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="收起侧栏"
            onClick={() =>
              setAppState((current) => ({
                ...current,
                sidebarOpen: false,
              }))
            }
          >
            <PanelLeft size={16} />
          </button>
        </div>

        <button className="new-task" type="button" onClick={createNewSession}>
          <Plus size={16} />
          <span>新任务</span>
          <kbd>⌘ N</kbd>
        </button>
        <button className="search-button" type="button">
          <Search size={15} />
          <span>搜索任务</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="sidebar-label">当前运行</div>
        <nav className="session-list" aria-label="任务">
          {appState.sessions.map((session) => (
            <div
              className={`session-item ${appState.activeSessionId === session.id ? "active" : ""}`}
              key={session.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                setAppState((current) => ({
                  ...current,
                  activeSessionId: session.id,
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setAppState((current) => ({
                    ...current,
                    activeSessionId: session.id,
                  }));
                }
              }}
            >
              <span className="session-copy">
                <strong>{session.title}</strong>
                <small>{session.detail}</small>
              </span>
              <span className="session-meta">
                <span className="session-time">{session.time}</span>
                <button
                  className="session-delete"
                  type="button"
                  aria-label={`删除任务：${session.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSession(session.id);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button">
            <Settings size={16} />
            <span>设置</span>
          </button>
          <div
            className={`runtime-status ${runtime.state}`}
            title={runtime.error ?? runtime.version ?? ""}
          >
            <span /> {runtimeLabel}
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          {!sidebarOpen && (
            <button
              className="icon-button"
              type="button"
              aria-label="展开侧栏"
              onClick={() =>
                setAppState((current) => ({
                  ...current,
                  sidebarOpen: true,
                }))
              }
            >
              <PanelLeft size={17} />
            </button>
          )}
          <div className="title-block">
            <strong>{activeTitle}</strong>
            <button
              className="workspace-link"
              type="button"
              onClick={chooseWorkspace}
              title={workspacePath || "选择工作区"}
            >
              <GitBranch size={13} />
              <span>{compactPath(workspacePath) || "选择工作区"}</span>
            </button>
          </div>
          <div className="topbar-actions">
            <button className="status-pill" type="button">
              <Check size={13} /> {runtimeLabel}
            </button>
            <button
              className="icon-button topbar-toggle"
              type="button"
              aria-label={rightSidebarOpen ? "关闭文件变更" : "打开文件变更"}
              aria-pressed={rightSidebarOpen}
              onClick={() =>
                setAppState((current) => ({
                  ...current,
                  rightSidebarOpen: !current.rightSidebarOpen,
                }))
              }
            >
              <PanelRight size={17} />
              {completedFileChangeCount > 0 && (
                <span className="topbar-badge">{completedFileChangeCount}</span>
              )}
            </button>
            <button className="icon-button" type="button" aria-label="更多操作">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        <section className="conversation" ref={conversationRef}>
          <div className="message-column">
            {messages.length === 0 && activities.length === 0 ? (
              <div className="empty-state">
                <span>
                  <Sparkles size={21} />
                </span>
                <h1>让 Codex 处理一个任务</h1>
                <p>Codex CLI 将在当前工作区真实读取、运行和修改文件。</p>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <article className={`message ${message.role}`} key={message.id}>
                    {message.role === "assistant" && (
                      <div className="assistant-mark">
                        <Sparkles size={14} />
                      </div>
                    )}
                    <div className="message-content">
                      {message.content || <span className="typing">Codex 正在思考…</span>}
                    </div>
                  </article>
                ))}

                {activities.map((activity) => (
                  <div className="activity-card" key={activity.id}>
                    <div className="activity-icon">
                      {activity.title === "运行命令" ? (
                        <TerminalSquare size={16} />
                      ) : (
                        <FileCode2 size={16} />
                      )}
                    </div>
                    <div>
                      <strong>{activity.title}</strong>
                      <span>{activity.detail || "处理中"}</span>
                    </div>
                    {activity.status === "inProgress" ? (
                      <span className="activity-spinner" />
                    ) : (
                      <Check size={16} className="activity-check" />
                    )}
                  </div>
                ))}

                {approvals.map((approval) => {
                  const copy = approvalCopy(approval);
                  return (
                    <div className="approval-card" key={approval.id}>
                      <div>
                        <strong>{copy.title}</strong>
                        <code>{copy.detail}</code>
                      </div>
                      <div className="approval-actions">
                        <button
                          type="button"
                          onClick={() => void answerApproval(approval, "decline")}
                        >
                          拒绝
                        </button>
                        <button
                          className="approve"
                          type="button"
                          onClick={() => void answerApproval(approval, "accept")}
                        >
                          允许
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(currentSession?.conversation.error ?? error) && (
                  <div className="error-card">{currentSession?.conversation.error ?? error}</div>
                )}
              </>
            )}
          </div>
        </section>

        <div className="composer-wrap">
          <form className="composer" onSubmit={sendMessage}>
            <textarea
              aria-label="任务描述"
              placeholder={
                runtime.state === "ready" ? "描述一个任务，Codex 将在工作区中执行" : runtimeLabel
              }
              value={composer}
              disabled={runtime.state !== "ready"}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="composer-toolbar">
              <div>
                <button className="tool-button" type="button">
                  <Paperclip size={16} />
                </button>
                <div className="model-picker" ref={modelPickerRef}>
                  <button
                    className="model-button"
                    type="button"
                    aria-expanded={modelMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setModelMenuOpen((open) => !open)}
                  >
                    {selectedModelOption.label} <ChevronDown size={13} />
                  </button>
                  {modelMenuOpen && (
                    <div className="model-menu" role="menu">
                      {MODEL_OPTIONS.map((option) => (
                        <button
                          className={option.id === selectedModel ? "selected" : ""}
                          key={option.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={option.id === selectedModel}
                          onClick={() => {
                            setAppState((current) => ({
                              ...current,
                              selectedModel: option.id,
                            }));
                            setModelMenuOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          <small>{option.detail}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="composer-context">
                workspace-write <span>·</span> {selectedModel}
              </div>
              {currentSessionActiveTurn ? (
                <button
                  className="send-button stop"
                  type="button"
                  onClick={() => void interrupt()}
                  aria-label="停止"
                >
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="send-button"
                  type="submit"
                  disabled={!composer.trim() || runtime.state !== "ready"}
                  aria-label="发送"
                >
                  <ArrowUp size={17} />
                </button>
              )}
            </div>
          </form>
          <p className="composer-hint">Codex 可在当前工作区修改文件；需要额外权限时会请求确认。</p>
        </div>

        <section className="workspace-split">
          <div className="work-column">
            <section className="conversation">
              <div className="message-column">
                {currentTab.messages.length === 0 ? (
                  <div className="empty-state">
                    <span>
                      <Sparkles size={21} />
                    </span>
                    <h1>从一个任务开始</h1>
                    <p>描述要构建、修改或调查的内容。</p>
                  </div>
                ) : (
                  currentTab.messages.map((message) => (
                    <article className={`message ${message.role}`} key={message.id}>
                      {message.role === "assistant" && (
                        <div className="assistant-mark">
                          <Sparkles size={14} />
                        </div>
                      )}
                      <div className="message-content">{message.content}</div>
                    </article>
                  ))
                )}

                {currentTab.messages.length > 0 && (
                  <div className="activity-card">
                    <div className="activity-icon">
                      <FileCode2 size={16} />
                    </div>
                    <div>
                      <strong>项目结构</strong>
                      <span>已读取 Electron 与 React 入口</span>
                    </div>
                    <Check size={16} className="activity-check" />
                  </div>
                )}
              </div>
            </section>

            <div className="composer-wrap">
              <form className="composer" onSubmit={sendMessage}>
                <textarea
                  aria-label="任务描述"
                  placeholder="描述一个任务，或输入 / 使用命令"
                  value={currentTab.composer}
                  onChange={(event) =>
                    updateActiveTab((tab) => ({ ...tab, composer: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <div className="composer-toolbar">
                  <div>
                    <button className="tool-button" type="button">
                      <Paperclip size={16} />
                    </button>
                    <button className="model-button" type="button">
                      Auto <ChevronDown size={13} />
                    </button>
                  </div>
                  <div className="composer-context">
                    本地上下文 <span>·</span> 0%
                  </div>
                  <button
                    className="send-button"
                    type="submit"
                    disabled={!currentTab.composer.trim()}
                    aria-label="发送"
                  >
                    <ArrowUp size={17} />
                  </button>
                </div>
              </form>
              <p className="composer-hint">iCode 可能会出错，请在应用修改前检查重要内容。</p>
            </div>
          </div>

          <aside className="right-rail" aria-label="任务上下文">
            <section className="rail-card file-tree">
              <div className="rail-header">
                <div>
                  <strong>文件树</strong>
                  <span>{workspace}</span>
                </div>
                <button className="mini-button" type="button">
                  <Plus size={13} />
                </button>
              </div>
              <div className="file-list">
                {currentTab.files.map((file) => (
                  <button
                    className={`file-row depth-${file.depth}`}
                    key={file.id}
                    type="button"
                    title={file.name}
                  >
                    {file.kind === "folder" ? <Folder size={14} /> : <File size={14} />}
                    <span>{file.name}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rail-card terminal-card">
              <div className="rail-header">
                <div>
                  <strong>终端</strong>
                  <span>local shell</span>
                </div>
                <Terminal size={14} />
              </div>
              <div className="terminal-window">
                {currentTab.terminalLines.map((line, index) => (
                  <div className="terminal-line" key={`${index}-${line}`}>
                    {line}
                  </div>
                ))}
                <div className="terminal-cursor">▌</div>
              </div>
            </section>
          </aside>
        </section>
      </main>

      {rightSidebarOpen && (
        <aside className="right-sidebar" aria-label="侧边面板">
          <div className="tab-bar">
            <div className="tab-strip" role="tablist">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={tab.id === activeTabId}
                  className={`tab-strip-item ${tab.id === activeTabId ? "active" : ""}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span className="tab-strip-title">{tab.title}</span>
                  {tab.kind !== "files" && (
                    <span
                      className="tab-strip-close"
                      role="button"
                      aria-label={`关闭 ${tab.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(tab.id);
                      }}
                    >
                      <X size={11} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="tab-add-wrap" ref={addMenuRef}>
              <button
                className="tab-add"
                type="button"
                aria-label="新建侧边栏标签页"
                title="新建侧边栏标签页"
                aria-expanded={addMenuOpen}
                onClick={() => setAddMenuOpen((open) => !open)}
              >
                <Plus size={13} />
              </button>
              {addMenuOpen && (
                <div className="tab-add-menu" role="menu">
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      addTab("tree");
                      setAddMenuOpen(false);
                    }}
                  >
                    <FolderTree size={13} /> <span>文件树</span>
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      addTab("terminal");
                      setAddMenuOpen(false);
                    }}
                  >
                    <TerminalSquare size={13} /> <span>终端</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="tab-content">
            {(() => {
              const tab = tabs.find((t) => t.id === activeTabId);
              if (!tab) return <div className="file-empty">点击 + 添加一个标签页</div>;
              if (tab.kind === "files") {
                return (
                  <>
                    <div className="files-header">
                      <span className="files-title">文件变更</span>
                      <small>{fileChanges.length} 个</small>
                    </div>
                    <div className="file-list">{renderFilesTabBody()}</div>
                  </>
                );
              }
              if (tab.kind === "terminal") return <TerminalTab tab={tab} />;
              return (
                <FileTreeTab
                  tab={tab}
                  expandedDirs={expandedDirs}
                  onToggleExpand={handleToggleExpand}
                />
              );
            })()}
          </div>
        </aside>
      )}
    </div>
  );

  function addTab(kind: RightSidebarTabKind) {
    const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const title = kind === "files" ? "文件变更" : kind === "terminal" ? "终端" : "文件树";
    setTabs((current) => [...current, { id, kind, title, cwd: workspacePath || undefined }]);
    setActiveTabId(id);
  }

  function closeTab(id: string) {
    const tab = tabsRef.current.find((t) => t.id === id);
    if (!tab || tab.kind === "files") return;
    if (tab.kind === "terminal") {
      const session = ptySessionsRef.current.get(id);
      if (session) {
        if (session.ptyId) void window.icode?.ptyKill({ id: session.ptyId }).catch(() => {});
        session.unsubscribe();
        session.exitUnsub();
        session.terminal?.dispose();
        session.cleanupResize();
        ptySessionsRef.current.delete(id);
      }
    }
    setTabs((current) => current.filter((t) => t.id !== id));
    setActiveTabId((current) => {
      if (current !== id) return current;
      const remaining = tabsRef.current.filter((t) => t.id !== id);
      return remaining[Math.max(0, remaining.length - 1)]?.id ?? "files";
    });
  }

  function renderFilesTabBody() {
    if (fileChanges.length === 0) return <div className="file-empty">暂无文件变更</div>;
    return (
      <>
        {fileChanges.map((change) => {
          const isOpen = !!expandedFiles[change.id];
          const lines = change.diff ? change.diff.split("\n") : [];
          const kindLabel = change.kind === "add" ? "A" : change.kind === "delete" ? "D" : "M";
          return (
            <div key={change.id} className={`file-row kind-${change.kind} status-${change.status}`}>
              <button
                className="file-row-header"
                type="button"
                onClick={() =>
                  setExpandedFiles((current) => ({
                    ...current,
                    [change.id]: !current[change.id],
                  }))
                }
                aria-expanded={isOpen}
              >
                <span className={`file-kind file-kind-${change.kind}`}>{kindLabel}</span>
                <span className="file-path" title={change.path}>
                  {change.path || "(未知路径)"}
                </span>
                {change.status === "inProgress" ? (
                  <span className="activity-spinner" />
                ) : change.status === "failed" ? (
                  <span className="file-failed">失败</span>
                ) : (
                  <Check size={13} className="activity-check" />
                )}
              </button>
              {isOpen && (
                <pre className="file-diff">
                  {lines.length === 0 ? (
                    <span className="file-diff-empty">无 diff 预览（可能被截断）</span>
                  ) : (
                    lines.map((line, i) => (
                      <span
                        key={i}
                        className={
                          line.startsWith("+") && !line.startsWith("+++")
                            ? "diff-add"
                            : line.startsWith("-") && !line.startsWith("---")
                              ? "diff-remove"
                              : "diff-ctx"
                        }
                      >
                        {line || " "}
                      </span>
                    ))
                  )}
                </pre>
              )}
            </div>
          );
        })}
      </>
    );
  }
}
