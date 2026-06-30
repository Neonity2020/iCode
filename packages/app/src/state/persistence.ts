import { DEFAULT_MODEL, MODEL_OPTIONS, PANEL_WIDTHS, STORAGE_KEY } from "../config/app";
import type {
  Conversation,
  ModelId,
  ScheduledTask,
  Session,
  StoredRightSidebarTab,
  StoredState,
} from "../domain/types";

const OLD_STORAGE_KEYS = ["icode.conversations.v1"];

function normalizeModel(value: unknown): ModelId {
  return MODEL_OPTIONS.some((option) => option.id === value) ? (value as ModelId) : DEFAULT_MODEL;
}

export function defaultTabs(): StoredRightSidebarTab[] {
  return [
    { id: "files", kind: "files", title: "文件变更" },
    { id: "scheduled", kind: "scheduled", title: "定时任务" },
  ];
}

function defaultTabTitle(kind: StoredRightSidebarTab["kind"]) {
  if (kind === "tree") return "文件树";
  if (kind === "terminal") return "终端";
  if (kind === "scheduled") return "定时任务";
  return "文件变更";
}

function normalizeStoredTabs(raw: unknown): StoredRightSidebarTab[] {
  const tabs: StoredRightSidebarTab[] = Array.isArray(raw)
    ? raw.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const id = typeof item.id === "string" && item.id ? item.id : "";
        const kind =
          item.kind === "tree" || item.kind === "terminal" || item.kind === "scheduled"
            ? item.kind
            : item.kind === "files"
              ? "files"
              : null;
        if (!id || !kind) return [];
        return [
          {
            id,
            kind,
            title: typeof item.title === "string" ? item.title : defaultTabTitle(kind),
            cwd: typeof item.cwd === "string" && item.cwd ? item.cwd : undefined,
          },
        ];
      })
    : [];
  const seen = new Set<string>();
  const unique = tabs.filter((tab) => {
    if (seen.has(tab.id)) return false;
    seen.add(tab.id);
    return true;
  });
  for (const tab of defaultTabs()) {
    if (!unique.some((entry) => entry.id === tab.id)) unique.push(tab);
  }
  return unique;
}

function normalizeExpandedDirs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((entry): entry is string => typeof entry === "string" && !!entry))];
}

function normalizeScheduledTasks(raw: unknown): ScheduledTask[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" && item.id ? item.id : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
    const schedule = item.schedule === "daily" ? "daily" : "interval";
    const rawIntervalMinutes = Number(item.intervalMinutes);
    const intervalMinutes = Number.isFinite(rawIntervalMinutes) ? rawIntervalMinutes : 60;
    const nextRunAt = typeof item.nextRunAt === "string" ? item.nextRunAt : "";
    const nextRunTime = Date.parse(nextRunAt);
    if (!id || !title || !prompt || !Number.isFinite(nextRunTime)) {
      return [];
    }
    const lastStatus =
      item.lastStatus === "running" ||
      item.lastStatus === "completed" ||
      item.lastStatus === "failed"
        ? item.lastStatus
        : "idle";
    return [
      {
        id,
        title,
        prompt,
        schedule,
        intervalMinutes: Math.max(1, Math.round(intervalMinutes)),
        nextRunAt: new Date(nextRunTime).toISOString(),
        enabled: item.enabled !== false,
        lastRunAt: typeof item.lastRunAt === "string" ? item.lastRunAt : undefined,
        lastStatus,
        lastError: typeof item.lastError === "string" ? item.lastError : undefined,
      },
    ];
  });
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
    scheduledTasks: [],
  };
  if (typeof window === "undefined") return fallback;
  for (const key of OLD_STORAGE_KEYS) window.localStorage.removeItem(key);
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const sessions =
      Array.isArray(parsed.sessions) && parsed.sessions.length > 0
        ? parsed.sessions
        : [fallbackSession];
    const tabs = normalizeStoredTabs(parsed.tabs);
    const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId)
      ? String(parsed.activeTabId)
      : tabs[0].id;
    const activeSessionId = sessions.some((session) => session.id === parsed.activeSessionId)
      ? Number(parsed.activeSessionId)
      : sessions[0].id;

    return {
      ...fallback,
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
      sessions,
      tabs,
      activeTabId,
      expandedDirs: normalizeExpandedDirs(parsed.expandedDirs),
      scheduledTasks: normalizeScheduledTasks(parsed.scheduledTasks),
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
