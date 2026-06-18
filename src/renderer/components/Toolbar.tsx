import { Bot, GitBranch, LoaderCircle } from 'lucide-react'
import type { AgentType } from '../../shared/types'
import { useWorkspaceStore } from '../stores/workspace'

const labels: Record<AgentType, string> = { codex: 'Codex', claude: 'Claude Code', opencode: 'OpenCode' }

export function Toolbar() {
  const { projects, runs, projectId, isStartingRun, selectedAgent, setAgent } = useWorkspaceStore()
  const project = projects.find((item) => item.id === projectId)
  const isRunning = isStartingRun || runs.some((run) => run.status === 'running')
  return (
    <header className="toolbar">
      <div><h1>{project?.name ?? 'No project selected'}</h1><span className="path">{project?.path ?? '~/icode'}</span></div>
      <div className="toolbar-actions">
        <span className="branch"><GitBranch size={15} />{project?.branch || 'No Git repository'}</span>
        <label className="agent-picker"><Bot size={16} /><select value={selectedAgent} onChange={(event) => setAgent(event.target.value as AgentType)}>{Object.entries(labels).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <span className={`run-status ${isRunning ? 'running' : 'idle'}`}><LoaderCircle size={14} /> {isRunning ? 'Running' : 'Idle'}</span>
      </div>
    </header>
  )
}
