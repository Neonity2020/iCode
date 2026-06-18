import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AgentRun, AgentRunStatus, ProjectSession } from '../../shared/types'
import type { WorkspaceService } from './workspace-service'

interface SessionStore {
  version: 2
  sessions: ProjectSession[]
  runs: AgentRun[]
}

const EMPTY_STORE: SessionStore = { version: 2, sessions: [], runs: [] }

export class SessionService {
  private readonly storePath: string
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(userDataPath: string, private readonly workspaceService: WorkspaceService) {
    this.storePath = path.join(userDataPath, 'sessions.json')
  }

  async list(projectId: string): Promise<ProjectSession[]> {
    await this.writeQueue
    const projectRoot = await this.workspaceService.resolveProjectRoot(projectId)
    const store = await this.readStore()
    return store.sessions
      .filter((session) => session.projectId === projectRoot)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async listRuns(sessionId: string): Promise<AgentRun[]> {
    await this.writeQueue
    const store = await this.readStore()
    return store.runs
      .filter((run) => run.sessionId === sessionId)
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt))
  }

  create(projectId: string, rawTitle: string): Promise<ProjectSession> {
    const operation = this.writeQueue.then(async () => {
      const projectRoot = await this.workspaceService.resolveProjectRoot(projectId)
      const title = this.validateTitle(rawTitle)
      const store = await this.readStore()
      const now = new Date().toISOString()
      const session: ProjectSession = {
        id: randomUUID(),
        projectId: projectRoot,
        title,
        createdAt: now,
        updatedAt: now,
      }

      await this.writeStore({ ...store, sessions: [...store.sessions, session] })
      return session
    })

    this.writeQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  startCodexRun(
    projectId: string,
    rawPrompt: string,
    sessionId?: string,
    forceNewSession = false,
  ): Promise<{ session: ProjectSession; run: AgentRun; providerThreadId?: string }> {
    const operation = this.writeQueue.then(async () => {
      const projectRoot = await this.workspaceService.resolveProjectRoot(projectId)
      const prompt = rawPrompt.trim()
      if (!prompt) throw new Error('Enter a prompt to start a session.')
      if (prompt.length > 100_000) throw new Error('The prompt is too long.')

      const store = await this.readStore()
      const now = new Date().toISOString()
      const requestedSession = sessionId ? store.sessions.find((item) => item.id === sessionId) : undefined
      const latestProjectSession = forceNewSession || sessionId
        ? undefined
        : store.sessions
          .filter((item) => item.projectId === projectRoot)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
      const existingSession = requestedSession ?? latestProjectSession
      if (sessionId && (!existingSession || existingSession.projectId !== projectRoot)) {
        throw new Error('The requested session does not belong to this project.')
      }
      const session: ProjectSession = existingSession ?? {
          id: randomUUID(),
          projectId: projectRoot,
          title: this.deriveTitle(prompt),
          createdAt: now,
          updatedAt: now,
        }
      const previousRuns = store.runs.filter((item) => item.sessionId === session.id)
      const providerThreadId = [...previousRuns].reverse().find((item) => item.providerThreadId)?.providerThreadId
      const runId = randomUUID()
      const run: AgentRun = {
        id: runId,
        projectId: projectRoot,
        sessionId: session.id,
        agent: 'codex',
        status: 'running',
        startedAt: now,
        entries: [{ id: randomUUID(), runId, kind: 'prompt', content: prompt, createdAt: now }],
      }

      const sessions = existingSession
        ? store.sessions.map((item) => item.id === session.id ? { ...item, updatedAt: now } : item)
        : [...store.sessions, session]
      const updatedSession = { ...session, updatedAt: now }
      await this.writeStore({ ...store, sessions, runs: [...store.runs, run] })
      return { session: updatedSession, run, providerThreadId }
    })

    this.writeQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  attachProviderIds(runId: string, providerThreadId: string, providerTurnId: string): Promise<AgentRun> {
    return this.updateRun(runId, (run) => ({ ...run, providerThreadId, providerTurnId }))
  }

  finishRun(runId: string, status: AgentRunStatus, response?: string): Promise<AgentRun> {
    return this.updateRun(runId, (run) => {
      const endedAt = new Date().toISOString()
      const entries = response
        ? [...run.entries, { id: randomUUID(), runId, kind: 'response' as const, content: response, createdAt: endedAt }]
        : run.entries
      return { ...run, status, endedAt, entries }
    })
  }

  private validateTitle(rawTitle: string): string {
    const title = rawTitle.trim()
    if (!title) throw new Error('Session title is required.')
    if (title.length > 120) throw new Error('Session title must be 120 characters or fewer.')
    if ([...title].some((character) => character.charCodeAt(0) <= 31)) {
      throw new Error('Session title contains characters that are not allowed.')
    }
    return title
  }

  private deriveTitle(prompt: string): string {
    const firstLine = prompt.split(/\r?\n/, 1)[0]
      .replace(/^\s*[-#>*]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (firstLine.length <= 52) return firstLine
    return `${firstLine.slice(0, 49).trimEnd()}...`
  }

  private updateRun(runId: string, update: (run: AgentRun) => AgentRun): Promise<AgentRun> {
    const operation = this.writeQueue.then(async () => {
      const store = await this.readStore()
      const index = store.runs.findIndex((run) => run.id === runId)
      if (index < 0) throw new Error('Agent run not found.')
      const run = update(store.runs[index])
      const runs = [...store.runs]
      runs[index] = run
      await this.writeStore({ ...store, runs })
      return run
    })
    this.writeQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  private async readStore(): Promise<SessionStore> {
    try {
      const contents = await readFile(this.storePath, 'utf8')
      const parsed = JSON.parse(contents) as { version?: number; sessions?: unknown; runs?: unknown }
      if (!Array.isArray(parsed.sessions)) throw new Error('Invalid session store.')
      if (parsed.version === 1) return { version: 2, sessions: parsed.sessions as ProjectSession[], runs: [] }
      if (parsed.version !== 2 || !Array.isArray(parsed.runs)) throw new Error('Invalid session store.')
      return { version: 2, sessions: parsed.sessions as ProjectSession[], runs: parsed.runs as AgentRun[] }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_STORE
      throw error
    }
  }

  private async writeStore(store: SessionStore): Promise<void> {
    await mkdir(path.dirname(this.storePath), { recursive: true })
    const temporaryPath = `${this.storePath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.storePath)
  }
}
