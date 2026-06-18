import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'
import { AgentService } from '../services/agent-service'

export function registerIpcHandlers(): void {
  const agentService = new AgentService()
  ipcMain.handle(IPC_CHANNELS.agentsList, () => agentService.list())
}
