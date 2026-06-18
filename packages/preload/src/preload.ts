import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@icode/shared'
import type { ICodeApi } from '@icode/shared'

const api: ICodeApi = {
  platform: process.platform,
  agents: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.agentsList),
  },
  projects: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.projectsList),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.projectsCreate, input.name),
    listEntries: (projectId, relativePath) => ipcRenderer.invoke(IPC_CHANNELS.projectEntriesList, projectId, relativePath),
  },
  sessions: {
    list: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.sessionsList, projectId),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.sessionsCreate, input.projectId, input.title),
    listRuns: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.sessionRunsList, sessionId),
  },
  codex: {
    start: (input) => ipcRenderer.invoke(
      IPC_CHANNELS.codexRunStart,
      input.projectId,
      input.prompt,
      input.sessionId,
      input.forceNewSession,
      input.model,
    ),
    interrupt: (runId) => ipcRenderer.invoke(IPC_CHANNELS.codexRunInterrupt, runId),
    listModels: () => ipcRenderer.invoke(IPC_CHANNELS.codexModelsList),
    onEvent: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, runEvent: Parameters<typeof listener>[0]) => listener(runEvent)
      ipcRenderer.on(IPC_CHANNELS.codexRunEvent, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.codexRunEvent, handler)
    },
    onApprovalRequest: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, request: Parameters<typeof listener>[0]) => listener(request)
      ipcRenderer.on(IPC_CHANNELS.codexApprovalRequest, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.codexApprovalRequest, handler)
    },
    respondApproval: (requestId, decision) => ipcRenderer.invoke(IPC_CHANNELS.codexApprovalRespond, requestId, decision),
  },
}

contextBridge.exposeInMainWorld('icode', api)
