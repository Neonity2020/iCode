export type AgentType = 'codex' | 'claude' | 'opencode'
export type AgentRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped'

/** Subset of Codex's `model/list` entry — the fields we actually use in the UI. */
export interface CodexModelInfo {
  /** Value sent to `thread/start`'s `model` parameter. */
  id: string
  /** Human-readable name shown in the picker. */
  displayName: string
  /** True when Codex tags this as its default model. */
  isDefault: boolean
  /** When true the model is functional but intentionally hidden from the picker. */
  hidden: boolean
}

export interface CodexModelListResponse {
  data: CodexModelInfo[]
  /** Opaque cursor; null when there are no more pages. */
  nextCursor: string | null
}

export interface Project {
  id: string
  name: string
  path: string
  branch: string
  lastOpenedAt: string
  status: 'clean' | 'changed' | 'unknown'
}

export interface CreateProjectInput {
  name: string
}

export interface ProjectEntry {
  name: string
  path: string
  type: 'directory' | 'file'
}

export interface ProjectSession {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface CreateSessionInput {
  projectId: string
  title: string
}

export interface TimelineEntry {
  id: string
  runId: string
  kind: 'prompt' | 'response' | 'tool' | 'change' | 'system'
  content: string
  createdAt: string
}

export interface AgentRun {
  id: string
  projectId: string
  sessionId: string
  agent: AgentType
  status: AgentRunStatus
  startedAt: string
  endedAt?: string
  handoffFromRunId?: string
  providerThreadId?: string
  providerTurnId?: string
  /** Codex model id used for this run (matches `CodexModelInfo.id`); undefined means Codex's default. */
  model?: string
  summary?: string
  entries: TimelineEntry[]
}

export interface StartCodexRunInput {
  projectId: string
  prompt: string
  sessionId?: string
  forceNewSession?: boolean
  /** Codex model id (matches `CodexModelInfo.id`) to spin up the thread with. Ignored when resuming an existing thread. */
  model?: string
}

export interface StartCodexRunResult {
  session: ProjectSession
  run: AgentRun
}

export type CodexRunEvent =
  | { type: 'response-delta'; runId: string; delta: string }
  | { type: 'run-completed'; run: AgentRun }
  | { type: 'run-failed'; run: AgentRun; message: string }
  | { type: 'run-stopped'; run: AgentRun }

/** A mid-turn permission request from Codex (e.g. before running a command or applying an edit). */
export interface CodexApprovalRequest {
  requestId: number | string
  runId: string
  kind: 'command' | 'file-change'
  summary: string
  details?: string
}

/** How the user wants to handle an approval request. `accept-for-session` is remembered by Codex for the thread. */
export type CodexApprovalDecision = 'accept-once' | 'accept-for-session' | 'reject'

export interface ProjectContext {
  projectId: string
  objective: string
  currentState: string
  nextSteps: string[]
  relevantFiles: string[]
  updatedAt: string
}

export interface AgentDescriptor {
  id: AgentType
  displayName: string
  executable: string
  installed: boolean
}

export interface ICodeApi {
  platform: NodeJS.Platform
  agents: {
    list(): Promise<AgentDescriptor[]>
  }
  projects: {
    list(): Promise<Project[]>
    create(input: CreateProjectInput): Promise<Project>
    listEntries(projectId: string, relativePath: string): Promise<ProjectEntry[]>
  }
  sessions: {
    list(projectId: string): Promise<ProjectSession[]>
    create(input: CreateSessionInput): Promise<ProjectSession>
    listRuns(sessionId: string): Promise<AgentRun[]>
  }
  codex: {
    start(input: StartCodexRunInput): Promise<StartCodexRunResult>
    interrupt(runId: string): Promise<void>
    /** Lists the models Codex currently exposes. Cached lazily by the main process. */
    listModels(): Promise<CodexModelListResponse>
    onEvent(listener: (event: CodexRunEvent) => void): () => void
    /** Subscribes to mid-turn approval requests from Codex. Returns an unsubscribe function. */
    onApprovalRequest(listener: (request: CodexApprovalRequest) => void): () => void
    /** Resolves a pending approval request with the user's decision. */
    respondApproval(requestId: number | string, decision: CodexApprovalDecision): Promise<void>
  }
}
