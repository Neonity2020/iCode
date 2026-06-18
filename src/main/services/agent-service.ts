import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { AgentDescriptor, AgentType } from '../../shared/types'

const execFileAsync = promisify(execFile)

const agents: Array<Omit<AgentDescriptor, 'installed'>> = [
  { id: 'codex', displayName: 'Codex', executable: 'codex' },
  { id: 'claude', displayName: 'Claude Code', executable: 'claude' },
  { id: 'opencode', displayName: 'OpenCode', executable: 'opencode' },
]

async function isInstalled(executable: string): Promise<boolean> {
  try {
    await execFileAsync('/usr/bin/env', ['which', executable])
    return true
  } catch {
    return false
  }
}

export class AgentService {
  async list(): Promise<AgentDescriptor[]> {
    return Promise.all(agents.map(async (agent) => ({ ...agent, installed: await isInstalled(agent.executable) })))
  }

  get(id: AgentType): Omit<AgentDescriptor, 'installed'> | undefined {
    return agents.find((agent) => agent.id === id)
  }
}
