export type AgentType = 'codex' | 'claude' | 'opencode'
export type AgentRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped'

export interface Project {
  id: string
  name: string
  path: string
  branch: string
  lastOpenedAt: string
  status: 'clean' | 'changed' | 'unknown'
}

export interface ProjectSession {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
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
  summary?: string
  entries: TimelineEntry[]
}

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
}
