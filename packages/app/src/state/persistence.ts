import { DEFAULT_MODEL, MODEL_OPTIONS, PANEL_WIDTHS, STORAGE_KEY } from "../config/app";
import type {
  Conversation,
  ModelId,
  Session,
  StoredRightSidebarTab,
  StoredState,
} from "../domain/types";

const OLD_STORAGE_KEYS = ["icode.conversations.v1"];

function normalizeModel(value: unknown): ModelId {
  return MODEL_OPTIONS.some((option) => option.id === value) ? (value as ModelId) : DEFAULT_MODEL;
}

export function defaultTabs(): StoredRightSidebarTab[] {
  return [{ id: "files", kind: "files", title: "文件变更" }];
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
  for (const key of OLD_STORAGE_KEYS) window.localStorage.removeItem(key);
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const sessions =
      Array.isArray(parsed.sessions) && parsed.sessions.length > 0
        ? parsed.sessions
        : [fallbackSession];
    const tabs = Array.isArray(parsed.tabs) && parsed.tabs.length > 0 ? parsed.tabs : defaultTabs();
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
