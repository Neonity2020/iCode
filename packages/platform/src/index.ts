export type ModelId = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini";

export type ImageDetail = "auto" | "low" | "high" | "original";

export type UserInput =
  | { type: "text"; text: string }
  | { type: "image"; url: string; detail?: ImageDetail }
  | { type: "localImage"; path: string; detail?: ImageDetail }
  | { type: "skill"; name: string; path: string }
  | { type: "mention"; name: string; path: string };

export type RuntimeState = {
  workspace: string;
  launchId: string;
  codex: {
    state: "starting" | "ready" | "error";
    version: string | null;
    error: string | null;
  };
};

export type CodexEvent =
  | {
      type: "status";
      status: {
        state: "starting" | "ready" | "error";
        version: string | null;
        error: string | null;
      };
    }
  | { type: "notification"; method: string; params: Record<string, unknown> }
  | {
      type: "request";
      request: {
        id: string | number;
        method: string;
        params: Record<string, unknown>;
      };
    }
  | { type: "stderr"; text: string };

export type FileSystemNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileSystemNode[];
};

export type WorkspaceChange = {
  path: string;
  kind: "add" | "modify" | "delete";
  diff: string;
  status: "inProgress" | "completed" | "failed";
};

export type PlatformCapabilities = {
  localWorkspace: boolean;
  fileSystem: boolean;
  terminal: boolean;
  workspaceChanges?: boolean;
};

export type AppSettings = {
  defaultModel: ModelId;
  codexCliPath: string;
  terminalShell: string;
};

export type SkillInfo = {
  id: string;
  name: string;
  description: string;
  path: string;
  source: "codex" | "system" | "agents" | "plugin";
  packageName?: string;
  status: "installed";
};

export type ICodePlatformApi = {
  kind: "desktop" | "web";
  capabilities: PlatformCapabilities;
  getState: () => Promise<RuntimeState>;
  pickDirectory: () => Promise<string | null>;
  startThread: (payload: { model: ModelId }) => Promise<{ thread: { id: string } }>;
  sendTurn: (payload: {
    threadId: string;
    input: UserInput[];
    model: ModelId;
  }) => Promise<{ turn: { id: string } }>;
  interruptTurn: (payload: { threadId: string; turnId: string }) => Promise<unknown>;
  respondToCodex: (payload: {
    id: string | number;
    result: Record<string, unknown>;
  }) => Promise<boolean>;
  onCodexEvent: (listener: (event: CodexEvent) => void) => () => void;
  openExternal: (url: string) => Promise<boolean>;
  openPath: (filePath: string) => Promise<boolean>;
  revealInFinder: (filePath: string) => Promise<boolean>;
  platform: string;
  ptySpawn: (payload: {
    cwd?: string;
    cols?: number;
    rows?: number;
    shell?: string;
  }) => Promise<{ id: string }>;
  ptyWrite: (payload: { id: string; data: string }) => Promise<boolean>;
  ptyResize: (payload: { id: string; cols: number; rows: number }) => Promise<boolean>;
  ptyKill: (payload: { id: string }) => Promise<boolean>;
  onPtyData: (listener: (event: { id: string; data: string }) => void) => () => void;
  onPtyExit: (
    listener: (event: { id: string; exitCode: number; signal?: number }) => void,
  ) => () => void;
  listFs: (payload: { path?: string; depth?: number }) => Promise<{
    root: string;
    truncated: boolean;
    children: FileSystemNode[];
  }>;
  getWorkspaceChanges: () => Promise<WorkspaceChange[]>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  resetSettings: () => Promise<AppSettings>;
  listSkills: () => Promise<SkillInfo[]>;
};
