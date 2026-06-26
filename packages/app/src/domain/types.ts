export type MessageAttachment = {
  type: "image";
  url: string;
  name?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: MessageAttachment[];
};

export type Activity = { id: string; title: string; detail: string; status: string };

export type Approval = {
  id: string | number;
  method: string;
  params: Record<string, unknown>;
};

export type ActiveTurn = { threadId: string; turnId: string };

export type FileChangeKind = "add" | "modify" | "delete";

export type FileChange = {
  id: string;
  path: string;
  kind: FileChangeKind;
  diff: string;
  status: "inProgress" | "completed" | "failed";
};

export type Conversation = {
  messages: Message[];
  activities: Activity[];
  approvals: Approval[];
  fileChanges: FileChange[];
  activeTurn: ActiveTurn | null;
  error: string | null;
};

export type Session = {
  id: number;
  title: string;
  detail: string;
  time: string;
  threadId?: string;
  conversation: Conversation;
};

export type RuntimeStatus = {
  state: "starting" | "ready" | "error";
  version: string | null;
  error: string | null;
  launchId: string | null;
};

export type ModelId = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini";

export type CodexItem = Record<string, unknown> & {
  id?: string;
  type?: string;
  status?: string;
};

export type RightSidebarTabKind = "files" | "terminal" | "tree";

export type RightSidebarTab = {
  id: string;
  kind: RightSidebarTabKind;
  title: string;
  cwd?: string;
};

export type StoredRightSidebarTab = {
  id: string;
  kind: "files" | "tree" | "terminal";
  title: string;
  cwd?: string;
};

export type StoredState = {
  appRunId: string | null;
  workspacePath: string;
  sidebarOpen: boolean;
  rightSidebarOpen: boolean;
  sidebarWidth: number;
  rightSidebarWidth: number;
  selectedModel: ModelId;
  activeSessionId: number;
  sessions: Session[];
  tabs: StoredRightSidebarTab[];
  activeTabId: string;
  expandedDirs: string[];
};

export type DirNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: DirNode[];
};

export type PtySession = {
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
