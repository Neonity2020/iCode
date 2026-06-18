import { ipcMain, type WebContents } from 'electron'
import { IPC_CHANNELS } from '@icode/shared'
import { AgentService } from '../services/agent-service'
import { WorkspaceService } from '../services/workspace-service'
import { SessionService } from '../services/session-service'
import { CodexAppServerService } from '../services/codex-app-server-service'
import type { CodexApprovalDecision, CodexApprovalRequest, CodexRunEvent } from '@icode/shared'

export function registerIpcHandlers(workspaceService: WorkspaceService, sessionService: SessionService, codexService: CodexAppServerService): void {
  const agentService = new AgentService()

  // Tracks the webContents that most recently started a Codex run, so mid-turn approval requests can be pushed to it.
  let activeSender: WebContents | null = null
  // Maps each outbound approval request to the promise resolved when the renderer responds.
  const pendingApprovals = new Map<string, { resolve: (decision: CodexApprovalDecision) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>()

  // Forward approval requests from Codex to the renderer; the renderer resolves them via `codexApprovalRespond`.
  codexService.configure({
    onApproval: async (request: CodexApprovalRequest) => {
      if (!activeSender || activeSender.isDestroyed()) {
        // No UI to ask; reject so Codex surfaces the denial rather than hanging.
        return 'reject'
      }
      activeSender.send(IPC_CHANNELS.codexApprovalRequest, request)
      return new Promise<CodexApprovalDecision>((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingApprovals.delete(String(request.requestId))
          reject(new Error('The approval request timed out.'))
        }, 5 * 60_000)
        pendingApprovals.set(String(request.requestId), { resolve, reject, timer })
      })
    },
  })

  ipcMain.handle(IPC_CHANNELS.codexApprovalRespond, (_event, requestId: number | string, decision: CodexApprovalDecision) => {
    const pending = pendingApprovals.get(String(requestId))
    if (!pending) return
    pendingApprovals.delete(String(requestId))
    clearTimeout(pending.timer)
    pending.resolve(decision)
  })

  ipcMain.handle(IPC_CHANNELS.agentsList, () => agentService.list())
  ipcMain.handle(IPC_CHANNELS.projectsList, () => workspaceService.listProjects())
  ipcMain.handle(IPC_CHANNELS.projectsCreate, (_event, name: string) => workspaceService.createProject(name))
  ipcMain.handle(IPC_CHANNELS.projectEntriesList, (_event, projectId: string, relativePath: string) => (
    workspaceService.listProjectEntries(projectId, relativePath)
  ))
  ipcMain.handle(IPC_CHANNELS.sessionsList, (_event, projectId: string) => sessionService.list(projectId))
  ipcMain.handle(IPC_CHANNELS.sessionsCreate, (_event, projectId: string, title: string) => sessionService.create(projectId, title))
  ipcMain.handle(IPC_CHANNELS.sessionRunsList, (_event, sessionId: string) => sessionService.listRuns(sessionId))
  ipcMain.handle(IPC_CHANNELS.codexRunStart, async (
    event,
    projectId: string,
    prompt: string,
    sessionId?: string,
    forceNewSession = false,
    model?: string,
  ) => {
    activeSender = event.sender
    const started = await sessionService.startCodexRun(projectId, prompt, sessionId, forceNewSession, model)
    const sendEvent = (runEvent: CodexRunEvent) => {
      if (!event.sender.isDestroyed()) event.sender.send(IPC_CHANNELS.codexRunEvent, runEvent)
    }

    const finishAndSend = async (status: 'completed' | 'failed' | 'stopped', response?: string, message?: string) => {
      try {
        const run = await sessionService.finishRun(started.run.id, status, response)
        if (status === 'completed') sendEvent({ type: 'run-completed', run })
        else if (status === 'stopped') sendEvent({ type: 'run-stopped', run })
        else sendEvent({ type: 'run-failed', run, message: message ?? 'Codex run failed.' })
      } catch (error) {
        console.error('Failed to persist Codex run completion', error)
      }
    }

    setImmediate(() => {
      let completionHandled = false
      void codexService.startRun(
        started.run.id,
        started.session.projectId,
        prompt.trim(),
        (delta) => sendEvent({ type: 'response-delta', runId: started.run.id, delta }),
        (status, response, message) => {
          completionHandled = true
          void finishAndSend(status, response, message)
        },
        started.providerThreadId,
        model,
      ).then((provider) => {
        void sessionService.attachProviderIds(started.run.id, provider.threadId, provider.turnId).catch((error) => {
          console.error('Failed to persist Codex provider identifiers', error)
        })
      }).catch((error: unknown) => {
        if (!completionHandled) {
          void finishAndSend('failed', undefined, error instanceof Error ? error.message : 'Unable to start Codex.')
        }
      })
    })

    return { session: started.session, run: started.run }
  })
  ipcMain.handle(IPC_CHANNELS.codexRunInterrupt, (_event, runId: string) => codexService.interrupt(runId))
  ipcMain.handle(IPC_CHANNELS.codexModelsList, () => codexService.listModels())
}
