import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'

type RunCompletionStatus = 'completed' | 'failed' | 'stopped'

/** A sandbox mode negotiated via `thread/start`. `workspaceWrite` lets Codex modify files inside `cwd`. */
export type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

/** Decision the user can make for an approval request. `accept-for-session` is remembered by Codex for the rest of the thread. */
export type CodexApprovalDecision = 'accept-once' | 'accept-for-session' | 'reject'

export interface CodexApprovalRequest {
  /** Echoed back when responding so the main process can match the pending request. */
  requestId: number | string
  runId: string
  kind: 'command' | 'file-change'
  /** Human-readable summary of what Codex wants to do (command line, or file patch/description). */
  summary: string
  details?: string
}

interface ActiveRun {
  runId: string
  threadId: string
  turnId: string | null
  response: string
  onDelta: (delta: string) => void
  onCompleted: (status: RunCompletionStatus, response: string, message?: string) => void
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

interface ProtocolMessage {
  id?: number | string
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { message?: string }
}

export class CodexAppServerService {
  private process: ChildProcessWithoutNullStreams | null = null
  private initializePromise: Promise<void> | null = null
  private nextRequestId = 1
  private readonly pending = new Map<number | string, PendingRequest>()
  private readonly runsByThread = new Map<string, ActiveRun>()
  private readonly runsById = new Map<string, ActiveRun>()
  private stderr = ''

  /**
   * Sandbox mode applied to every thread. Defaults to `workspace-write` so Codex can edit the
   * project directory while still being isolated from the rest of the file system.
   */
  private sandboxMode: CodexSandboxMode = 'workspace-write'

  /** Called when Codex asks for permission mid-turn. The callback resolves with the user's decision. */
  private approvalHandler: ((request: CodexApprovalRequest) => Promise<CodexApprovalDecision>) | null = null

  /** Configure how Codex is sandboxed and how approval requests are resolved. */
  configure(options: { sandbox?: CodexSandboxMode; onApproval?: (request: CodexApprovalRequest) => Promise<CodexApprovalDecision> }): void {
    if (options.sandbox) this.sandboxMode = options.sandbox
    if (options.onApproval) this.approvalHandler = options.onApproval
  }

  async startRun(
    runId: string,
    cwd: string,
    prompt: string,
    onDelta: ActiveRun['onDelta'],
    onCompleted: ActiveRun['onCompleted'],
    existingThreadId?: string,
  ): Promise<{ threadId: string; turnId: string }> {
    await this.ensureInitialized()
    const threadResult = await this.request<{ thread: { id: string } }>(existingThreadId ? 'thread/resume' : 'thread/start', {
      ...(existingThreadId ? { threadId: existingThreadId } : {}),
      cwd,
      // `workspace-write` lets Codex edit files inside `cwd` while isolating the rest of the file system.
      // NOTE: the wire value is kebab-case (`workspace-write`), not the camelCase alias some docs show.
      sandbox: this.sandboxMode,
      // `on-request` makes Codex ask for approval when it wants to take an action that needs permission;
      // once the user picks "accept-for-session", Codex remembers the grant for the rest of the thread.
      approvalPolicy: 'on-request',
    })
    const threadId = threadResult.thread.id
    const activeRun: ActiveRun = { runId, threadId, turnId: null, response: '', onDelta, onCompleted }
    this.runsByThread.set(threadId, activeRun)
    this.runsById.set(runId, activeRun)

    try {
      const turnResult = await this.request<{ turn: { id: string } }>('turn/start', {
        threadId,
        input: [{ type: 'text', text: prompt, text_elements: [] }],
      })
      activeRun.turnId = turnResult.turn.id
      return { threadId, turnId: turnResult.turn.id }
    } catch (error) {
      this.removeRun(activeRun)
      throw error
    }
  }

  async interrupt(runId: string): Promise<void> {
    const run = this.runsById.get(runId)
    if (!run?.turnId) throw new Error('This Codex run is not active.')
    await this.request('turn/interrupt', { threadId: run.threadId, turnId: run.turnId })
  }

  dispose(): void {
    this.process?.kill()
    this.process = null
    this.initializePromise = null
  }

  private ensureInitialized(): Promise<void> {
    if (this.initializePromise) return this.initializePromise
    this.initializePromise = this.startProcessAndInitialize().catch((error) => {
      this.initializePromise = null
      throw error
    })
    return this.initializePromise
  }

  private async startProcessAndInitialize(): Promise<void> {
    const child = spawn('codex', ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.process = child
    this.stderr = ''

    createInterface({ input: child.stdout }).on('line', (line) => this.handleLine(line))
    child.stderr.on('data', (chunk: Buffer) => {
      this.stderr = `${this.stderr}${chunk.toString()}`.slice(-4_000)
    })
    child.once('error', (error) => this.handleExit(error))
    child.once('exit', (code, signal) => {
      this.handleExit(new Error(`Codex app-server exited (${signal ?? code ?? 'unknown'}). ${this.stderr}`.trim()))
    })

    await this.request('initialize', {
      clientInfo: { name: 'icode', title: 'iCode', version: '0.1.0' },
      capabilities: { experimentalApi: false, requestAttestation: false },
    })
    this.notify('initialized', {})
  }

  private request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    const id = this.nextRequestId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex request timed out: ${method}`))
      }, 30_000)
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer })
      this.send({ method, id, params })
    })
  }

  private notify(method: string, params: Record<string, unknown>): void {
    this.send({ method, params })
  }

  private send(message: ProtocolMessage): void {
    if (!this.process?.stdin.writable) throw new Error('Codex app-server is not running.')
    this.process.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private handleLine(line: string): void {
    let message: ProtocolMessage
    try {
      message = JSON.parse(line) as ProtocolMessage
    } catch {
      return
    }

    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message ?? 'Codex request failed.'))
      else pending.resolve(message.result)
      return
    }

    if (message.id !== undefined && message.method) {
      void this.handleApprovalRequest(message)
      return
    }

    this.handleNotification(message)
  }

  private handleNotification(message: ProtocolMessage): void {
    const params = message.params
    const threadId = typeof params?.threadId === 'string' ? params.threadId : null
    if (!threadId) return
    const run = this.runsByThread.get(threadId)
    if (!run) return

    if (message.method === 'item/agentMessage/delta' && typeof params?.delta === 'string') {
      run.response += params.delta
      run.onDelta(params.delta)
      return
    }

    if (message.method === 'error') {
      if (params?.willRetry === true) return
      const error = params?.error as { message?: string } | undefined
      this.removeRun(run)
      run.onCompleted('failed', run.response, error?.message ?? 'Codex run failed.')
      return
    }

    if (message.method === 'turn/completed') {
      const turn = params?.turn as { status?: string; error?: { message?: string } | null } | undefined
      const status: RunCompletionStatus = turn?.status === 'interrupted' ? 'stopped' : turn?.status === 'failed' ? 'failed' : 'completed'
      this.removeRun(run)
      run.onCompleted(status, run.response, turn?.error?.message)
    }
  }

  private removeRun(run: ActiveRun): void {
    this.runsByThread.delete(run.threadId)
    this.runsById.delete(run.runId)
  }

  /**
   * Handles a server-initiated approval request (e.g. `item/commandExecution/requestApproval`).
   * If an approval handler is configured, the request is forwarded to it; the resolved decision is
   * sent back to Codex. `accept-for-session` is remembered by Codex for the rest of the thread, so
   * the user typically only confirms once per action type. Without a handler the request is rejected.
   */
  private async handleApprovalRequest(message: ProtocolMessage): Promise<void> {
    const params = message.params ?? {}
    const threadId = typeof params.threadId === 'string' ? params.threadId : null
    const run = threadId ? this.runsByThread.get(threadId) : null
    const method = message.method ?? ''
    const isCommand = method.includes('commandExecution') || method.includes('Command')
    const summary = this.extractApprovalSummary(message)
    const requestId = message.id as number | string

    const request: CodexApprovalRequest = {
      requestId,
      runId: run?.runId ?? threadId ?? 'unknown',
      kind: isCommand ? 'command' : 'file-change',
      summary,
      details: typeof params.explanation === 'string' ? params.explanation : undefined,
    }

    try {
      const decision = this.approvalHandler
        ? await this.approvalHandler(request)
        : 'reject'
      const decisionValue = this.mapDecision(decision)
      this.send({ id: requestId, result: { decision: decisionValue } })
    } catch (error) {
      this.send({ id: requestId, error: { message: error instanceof Error ? error.message : 'Approval failed.' } })
    }
  }

  /** Builds a short, human-readable description of what Codex is asking permission to do. */
  private extractApprovalSummary(message: ProtocolMessage): string {
    const params = (message.params ?? {}) as Record<string, unknown>
    const command = params.command
    if (Array.isArray(command)) return command.filter(Boolean).join(' ')
    if (typeof command === 'string') return command
    const changes = params.changes
    if (Array.isArray(changes) && changes.length > 0) {
      return `${changes.length} file change${changes.length === 1 ? '' : 's'} proposed`
    }
    if (typeof params.change === 'string') return params.change
    return message.method ?? 'Codex approval request'
  }

  /** Maps iCode's decision enum onto the wire values Codex expects. */
  private mapDecision(decision: CodexApprovalDecision): string {
    switch (decision) {
      case 'accept-once': return 'acceptOnce'
      case 'accept-for-session': return 'acceptForSession'
      default: return 'reject'
    }
  }

  private handleExit(error: Error): void {
    if (!this.process) return
    this.process = null
    this.initializePromise = null
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
    for (const run of this.runsById.values()) run.onCompleted('failed', run.response, error.message)
    this.runsById.clear()
    this.runsByThread.clear()
  }
}
