import { Bot, GitBranch, LoaderCircle } from 'lucide-react'
import type { AgentType } from '../../shared/types'
import { projects } from '../data/demo'
import { useWorkspaceStore } from '../stores/workspace'

const labels: Record<AgentType, string> = { codex: 'Codex', claude: 'Claude Code', opencode: 'OpenCode' }

export function Toolbar() {
  const { projectId, selectedAgent, setAgent } = useWorkspaceStore()
  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  return (
    <header className="toolbar">
      <div><h1>{project.name}</h1><span className="path">{project.path}</span></div>
      <div className="toolbar-actions">
        <span className="branch"><GitBranch size={15} />{project.branch}</span>
        <label className="agent-picker"><Bot size={16} /><select value={selectedAgent} onChange={(event) => setAgent(event.target.value as AgentType)}>{Object.entries(labels).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>
        <span className="run-status"><LoaderCircle size={14} /> Running</span>
      </div>
    </header>
  )
}
