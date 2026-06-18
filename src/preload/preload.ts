import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type { ICodeApi } from '../shared/types'

const api: ICodeApi = {
  platform: process.platform,
  agents: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.agentsList),
  },
}

contextBridge.exposeInMainWorld('icode', api)
