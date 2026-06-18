import { create } from 'zustand'
import type { AgentRun, AgentType, CodexApprovalDecision, CodexApprovalRequest, CodexModelInfo, CodexRunEvent, Project, ProjectSession } from '@icode/shared'

type RightPanelTab = 'files' | 'git' | 'terminal'

const pendingCodexEvents = new Map<string, CodexRunEvent[]>()
let sessionsLoadGeneration = 0

function bufferCodexEvent(event: CodexRunEvent): void {
  const runId = event.type === 'response-delta' ? event.runId : event.run.id
  pendingCodexEvents.set(runId, [...(pendingCodexEvents.get(runId) ?? []), event])
}

function invalidateSessionLoads(): void {
  sessionsLoadGeneration += 1
}

interface WorkspaceState {
  projects: Project[]
  sessions: ProjectSession[]
  runs: AgentRun[]
  projectId: string
  sessionId: string
  isLoadingProjects: boolean
  isLoadingSessions: boolean
  isLoadingRuns: boolean
  isStartingRun: boolean
  forceNewSession: boolean
  projectError: string | null
  sessionError: string | null
  runError: string | null
  selectedAgent: AgentType
  /** Codex model id the user has picked for the next run (matches `CodexModelInfo.id`). */
  selectedModel: string
  /** Model catalog pulled from Codex's `model/list` — filtered to hide `hidden` entries. */
  availableModels: CodexModelInfo[]
  isLoadingModels: boolean
  modelError: string | null
  rightPanelTab: RightPanelTab
  /** Mid-turn permission request surfaced from Codex, or null when none is pending. */
  pendingApproval: CodexApprovalRequest | null
  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<Project>
  loadSessions: (projectId: string) => Promise<void>
  createSession: (title: string) => Promise<ProjectSession>
  loadRuns: (sessionId: string) => Promise<void>
  /** Fetches the Codex model catalog and primes `availableModels`. */
  loadAvailableModels: () => Promise<void>
  startCodexRun: (prompt: string, options?: { model?: string }) => Promise<void>
  interruptRun: (runId: string) => Promise<void>
  applyCodexEvent: (event: CodexRunEvent) => void
  /** Records an approval request pushed from the main process. */
  setPendingApproval: (request: CodexApprovalRequest | null) => void
  /** Resolves the current approval request with the user's decision. */
  respondApproval: (decision: CodexApprovalDecision) => Promise<void>
  beginSession: () => void
  setProject: (projectId: string) => void
  setSession: (sessionId: string) => void
  setAgent: (agent: AgentType) => void
  setModel: (model: string) => void
  setRightPanelTab: (tab: RightPanelTab) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projects: [],
  sessions: [],
  runs: [],
  projectId: '',
  sessionId: '',
  isLoadingProjects: false,
  isLoadingSessions: false,
  isLoadingRuns: false,
  isStartingRun: false,
  forceNewSession: false,
  projectError: null,
  sessionError: null,
  runError: null,
  selectedAgent: 'codex',
  selectedModel: 'gpt-5.4-mini',
  availableModels: [],
  isLoadingModels: false,
  modelError: null,
  rightPanelTab: 'files',
  pendingApproval: null,
  loadProjects: async () => {
    set({ isLoadingProjects: true, projectError: null })
    try {
      const projects = await window.icode.projects.list()
      set((state) => ({
        projects,
        projectId: projects.some((project) => project.id === state.projectId)
          ? state.projectId
          : (projects[0]?.id ?? ''),
        isLoadingProjects: false,
      }))
    } catch (error) {
      set({ isLoadingProjects: false, projectError: error instanceof Error ? error.message : 'Unable to load projects.' })
    }
  },
  createProject: async (name) => {
    const project = await window.icode.projects.create({ name })
    invalidateSessionLoads()
    set((state) => ({
      projects: [...state.projects, project].sort((left, right) => left.name.localeCompare(right.name)),
      projectId: project.id,
      sessions: [],
      runs: [],
      sessionId: '',
      isLoadingSessions: false,
      forceNewSession: false,
      projectError: null,
      sessionError: null,
      runError: null,
    }))
    return project
  },
  loadSessions: async (projectId) => {
    const loadGeneration = ++sessionsLoadGeneration
    set({ isLoadingSessions: true, sessionError: null })
    try {
      const sessions = await window.icode.sessions.list(projectId)
      if (get().projectId !== projectId || loadGeneration !== sessionsLoadGeneration) return
      set((state) => ({
        sessions,
        sessionId: sessions.some((session) => session.id === state.sessionId)
          ? state.sessionId
          : (sessions[0]?.id ?? ''),
        forceNewSession: false,
        isLoadingSessions: false,
      }))
    } catch (error) {
      if (get().projectId !== projectId || loadGeneration !== sessionsLoadGeneration) return
      set({ sessions: [], sessionId: '', isLoadingSessions: false, sessionError: error instanceof Error ? error.message : 'Unable to load sessions.' })
    }
  },
  createSession: async (title) => {
    const projectId = get().projectId
    if (!projectId) throw new Error('Select a project before creating a session.')
    invalidateSessionLoads()
    set({ isLoadingSessions: false })
    const session = await window.icode.sessions.create({ projectId, title })
    if (get().projectId === projectId) {
      set((state) => ({
        sessions: [session, ...state.sessions],
        sessionId: session.id,
        forceNewSession: false,
        sessionError: null,
      }))
    }
    return session
  },
  loadRuns: async (sessionId) => {
    set({ isLoadingRuns: true, runError: null })
    try {
      const runs = await window.icode.sessions.listRuns(sessionId)
      if (get().sessionId === sessionId) set({ runs, isLoadingRuns: false })
    } catch (error) {
      if (get().sessionId === sessionId) set({ runs: [], isLoadingRuns: false, runError: error instanceof Error ? error.message : 'Unable to load agent runs.' })
    }
  },
  loadAvailableModels: async () => {
    if (get().isLoadingModels) return
    set({ isLoadingModels: true, modelError: null })
    try {
      const response = await window.icode.codex.listModels()
      const visible = response.data.filter((model) => !model.hidden)
      const currentSelectionStillValid = visible.some((model) => model.id === get().selectedModel)
      const fallback = visible.find((model) => model.isDefault) ?? visible[0]
      set((state) => ({
        availableModels: visible,
        isLoadingModels: false,
        // Keep the user's pick if it still exists; otherwise fall back to Codex's default, then the first entry.
        selectedModel: currentSelectionStillValid ? state.selectedModel : (fallback?.id ?? state.selectedModel),
        modelError: visible.length === 0 ? 'Codex did not return any selectable models.' : null,
      }))
    } catch (error) {
      set({
        isLoadingModels: false,
        modelError: error instanceof Error ? error.message : 'Unable to load Codex models.',
      })
    }
  },
  startCodexRun: async (prompt, options) => {
    const projectId = get().projectId
    if (!projectId) throw new Error('Select a project before starting Codex.')
    invalidateSessionLoads()
    set({ isLoadingSessions: false, isStartingRun: true, runError: null, selectedAgent: 'codex' })
    try {
      const state = get()
      const currentSessionId = state.sessionId || state.runs.at(-1)?.sessionId
      const model = options?.model ?? state.selectedModel
      const { session, run } = await window.icode.codex.start({
        projectId,
        prompt,
        sessionId: currentSessionId,
        forceNewSession: state.forceNewSession,
        model,
      })
      if (get().projectId !== projectId) {
        pendingCodexEvents.delete(run.id)
        set({ isStartingRun: false })
        return
      }
      set((state) => ({
        sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
        sessionId: session.id,
        forceNewSession: false,
        runs: currentSessionId ? [...state.runs, run] : [run],
        isStartingRun: false,
      }))
      const bufferedEvents = pendingCodexEvents.get(run.id) ?? []
      pendingCodexEvents.delete(run.id)
      bufferedEvents.forEach((event) => get().applyCodexEvent(event))
    } catch (error) {
      set({ isStartingRun: false, runError: error instanceof Error ? error.message : 'Unable to start Codex.' })
      throw error
    }
  },
  interruptRun: async (runId) => {
    try {
      await window.icode.codex.interrupt(runId)
    } catch (error) {
      set({ runError: error instanceof Error ? error.message : 'Unable to stop Codex.' })
    }
  },
  applyCodexEvent: (event) => {
    const runId = event.type === 'response-delta' ? event.runId : event.run.id
    if (!get().runs.some((run) => run.id === runId)) {
      bufferCodexEvent(event)
      return
    }
    if (event.type === 'response-delta') {
      set((state) => ({
        runs: state.runs.map((run) => {
          if (run.id !== event.runId) return run
          const streamingId = `stream-${run.id}`
          const existing = run.entries.find((entry) => entry.id === streamingId)
          const entries = existing
            ? run.entries.map((entry) => entry.id === streamingId ? { ...entry, content: entry.content + event.delta } : entry)
            : [...run.entries, { id: streamingId, runId: run.id, kind: 'response' as const, content: event.delta, createdAt: new Date().toISOString() }]
          return { ...run, entries }
        }),
      }))
      return
    }
    set((state) => ({
      runs: state.runs.map((run) => run.id === event.run.id ? event.run : run),
      runError: event.type === 'run-failed' ? event.message : state.runError,
    }))
  },
  beginSession: () => {
    invalidateSessionLoads()
    set({ sessionId: '', runs: [], isLoadingSessions: false, forceNewSession: true, runError: null })
  },
  setPendingApproval: (pendingApproval) => set({ pendingApproval }),
  respondApproval: async (decision) => {
    const { pendingApproval } = get()
    if (!pendingApproval) return
    const requestId = pendingApproval.requestId
    set({ pendingApproval: null })
    try {
      await window.icode.codex.respondApproval(requestId, decision)
    } catch (error) {
      set({ runError: error instanceof Error ? error.message : 'Unable to send the approval response.' })
    }
  },
  setProject: (projectId) => {
    // Clicking the already-active project should be inert — clearing here would
    // wipe sessions/runs with no state change to retrigger the load effects.
    if (get().projectId === projectId) return
    invalidateSessionLoads()
    set({
      projectId,
      sessions: [],
      runs: [],
      sessionId: '',
      isLoadingSessions: false,
      isStartingRun: false,
      forceNewSession: false,
      sessionError: null,
      runError: null,
    })
  },
  setSession: (sessionId) => {
    // Same guard as setProject: re-clicking the active session must not clear runs.
    if (get().sessionId === sessionId) return
    set({ sessionId, runs: [], forceNewSession: false, runError: null })
  },
  setAgent: (selectedAgent) => set({ selectedAgent }),
  setModel: (selectedModel) => set({ selectedModel }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
}))
