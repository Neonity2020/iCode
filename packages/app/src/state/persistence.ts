import { DEFAULT_MODEL, MODEL_OPTIONS, PANEL_WIDTHS, STORAGE_KEY } from "../config/app";
import type {
  Conversation,
  FileChange,
  FileChangeKind,
  MessageAttachment,
  Message,
  ModelId,
  Session,
  StoredRightSidebarTab,
  StoredState,
} from "../domain/types";

function normalizeModel(value: unknown): ModelId {
  return MODEL_OPTIONS.some((option) => option.id === value) ? (value as ModelId) : DEFAULT_MODEL;
}

function defaultTabTitle(kind: StoredRightSidebarTab["kind"]) {
  if (kind === "tree") return "文件树";
  if (kind === "terminal") return "终端";
  return "文件变更";
}

export function defaultTabs(): StoredRightSidebarTab[] {
  return [{ id: "files", kind: "files", title: "文件变更" }];
}

function normalizeStoredTabs(raw: unknown): StoredRightSidebarTab[] {
  if (!Array.isArray(raw)) return defaultTabs();
  const seen = new Set<string>();
  const tabs: StoredRightSidebarTab[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const kind = item.kind === "tree" || item.kind === "terminal" ? item.kind : "files";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    tabs.push({
      id,
      kind,
      title: typeof item.title === "string" ? item.title : defaultTabTitle(kind),
      cwd: typeof item.cwd === "string" && item.cwd ? item.cwd : undefined,
    });
  }
  if (!tabs.some((tab) => tab.id === "files" && tab.kind === "files")) {
    tabs.unshift({ id: "files", kind: "files", title: "文件变更" });
  }
  return tabs.length > 0 ? tabs : defaultTabs();
}

function normalizeExpandedDirs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((entry): entry is string => typeof entry === "string" && !!entry))];
}

export function emptyConversation(): Conversation {
  return {
    messages: [],
    activities: [],
    approvals: [],
    fileChanges: [],
    activeTurn: null,
    error: null,
  };
}

export function buildSession(overrides: Partial<Session> = {}): Session {
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
          if (typeof item.id !== "string" || (item.role !== "user" && item.role !== "assistant"))
            return null;
          const attachments: MessageAttachment[] | undefined = Array.isArray(item.attachments)
            ? item.attachments.flatMap((attachment) => {
                if (!attachment || typeof attachment !== "object") return [];
                const entry = attachment as Record<string, unknown>;
                if (entry.type !== "image" || typeof entry.url !== "string") return [];
                return [
                  {
                    type: "image" as const,
                    url: entry.url,
                    ...(typeof entry.name === "string" ? { name: entry.name } : {}),
                  },
                ];
              })
            : undefined;
          const normalized: Message = {
            id: item.id,
            role: item.role,
            content: typeof item.content === "string" ? item.content : "",
            attachments,
          };
          return normalized;
        })
        .filter((message): message is Message => message !== null)
    : [];

  const activities = Array.isArray(source.activities)
    ? source.activities.flatMap((activity) => {
        if (!activity || typeof activity !== "object") return [];
        const item = activity as Record<string, unknown>;
        if (typeof item.id !== "string") return [];
        return [
          {
            id: item.id,
            title: typeof item.title === "string" ? item.title : "Codex 活动",
            detail: typeof item.detail === "string" ? item.detail : "",
            status: typeof item.status === "string" ? item.status : "completed",
          },
        ];
      })
    : [];

  const approvals = Array.isArray(source.approvals)
    ? source.approvals.flatMap((approval) => {
        if (!approval || typeof approval !== "object") return [];
        const item = approval as Record<string, unknown>;
        if (
          typeof item.method !== "string" ||
          (typeof item.id !== "string" && typeof item.id !== "number")
        )
          return [];
        return [
          {
            id: item.id,
            method: item.method,
            params:
              item.params && typeof item.params === "object"
                ? (item.params as Record<string, unknown>)
                : {},
          },
        ];
      })
    : [];

  const fileChanges = Array.isArray(source.fileChanges)
    ? source.fileChanges.flatMap((change) => {
        if (!change || typeof change !== "object") return [];
        const item = change as Record<string, unknown>;
        if (typeof item.id !== "string") return [];
        const rawKind = typeof item.kind === "string" ? item.kind : "modify";
        const kind: FileChangeKind = rawKind === "add" || rawKind === "delete" ? rawKind : "modify";
        const rawStatus = typeof item.status === "string" ? item.status : "completed";
        const status: FileChange["status"] =
          rawStatus === "inProgress" || rawStatus === "failed" ? rawStatus : "completed";
        return [
          {
            id: item.id,
            path: typeof item.path === "string" ? item.path : "",
            kind,
            diff: typeof item.diff === "string" ? item.diff : "",
            status,
          },
        ];
      })
    : [];

  const activeTurnSource =
    source.activeTurn && typeof source.activeTurn === "object"
      ? (source.activeTurn as Record<string, unknown>)
      : null;
  const threadId = typeof activeTurnSource?.threadId === "string" ? activeTurnSource.threadId : "";
  const turnId = typeof activeTurnSource?.turnId === "string" ? activeTurnSource.turnId : "";

  return {
    messages,
    activities,
    approvals,
    fileChanges,
    activeTurn: threadId && turnId ? { threadId, turnId } : null,
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

export function loadStoredState(): StoredState {
  const fallbackSession = buildSession();
  const fallback: StoredState = {
    appRunId: null,
    workspacePath: "",
    sidebarOpen: true,
    rightSidebarOpen: true,
    sidebarWidth: PANEL_WIDTHS.left.default,
    rightSidebarWidth: PANEL_WIDTHS.right.default,
    selectedModel: DEFAULT_MODEL,
    activeSessionId: fallbackSession.id,
    sessions: [fallbackSession],
    tabs: defaultTabs(),
    activeTabId: "files",
    expandedDirs: [],
  };
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const sessions = Array.isArray(parsed.sessions)
      ? parsed.sessions.map(normalizeSession).filter((session): session is Session => !!session)
      : [];
    const normalizedSessions = sessions.length > 0 ? sessions : [fallbackSession];
    const activeSessionId = normalizedSessions.some(
      (session) => session.id === parsed.activeSessionId,
    )
      ? Number(parsed.activeSessionId)
      : normalizedSessions[0].id;
    const tabs = normalizeStoredTabs(parsed.tabs);
    const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId)
      ? String(parsed.activeTabId)
      : tabs[0].id;

    return {
      appRunId: typeof parsed.appRunId === "string" ? parsed.appRunId : null,
      workspacePath: typeof parsed.workspacePath === "string" ? parsed.workspacePath : "",
      sidebarOpen: typeof parsed.sidebarOpen === "boolean" ? parsed.sidebarOpen : true,
      rightSidebarOpen:
        typeof parsed.rightSidebarOpen === "boolean" ? parsed.rightSidebarOpen : true,
      sidebarWidth:
        typeof parsed.sidebarWidth === "number" && Number.isFinite(parsed.sidebarWidth)
          ? parsed.sidebarWidth
          : PANEL_WIDTHS.left.default,
      rightSidebarWidth:
        typeof parsed.rightSidebarWidth === "number" && Number.isFinite(parsed.rightSidebarWidth)
          ? parsed.rightSidebarWidth
          : PANEL_WIDTHS.right.default,
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

export function resetSessionForNewLaunch(session: Session): Session {
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

export function persistState(state: StoredState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
