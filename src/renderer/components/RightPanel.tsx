import { FileCode2, GitCompare, TerminalSquare } from 'lucide-react'
import { context } from '../data/demo'
import { useWorkspaceStore } from '../stores/workspace'
import { ProjectFileTree } from './ProjectFileTree'

export function RightPanel() {
  const { projects, projectId, rightPanelTab, setRightPanelTab } = useWorkspaceStore()
  const project = projects.find((candidate) => candidate.id === projectId)
  return <aside className="right-panel">
    <div className="tabs"><button className={rightPanelTab === 'files' ? 'active' : ''} onClick={() => setRightPanelTab('files')}><FileCode2 size={15} />Files</button><button className={rightPanelTab === 'git' ? 'active' : ''} onClick={() => setRightPanelTab('git')}><GitCompare size={15} />Git <b>3</b></button><button className={rightPanelTab === 'terminal' ? 'active' : ''} onClick={() => setRightPanelTab('terminal')}><TerminalSquare size={15} />Terminal</button></div>
    <div className="panel-content">
      {rightPanelTab === 'files' && <><div className="panel-label">{project?.name.toUpperCase() ?? 'FILES'}</div><ProjectFileTree key={project?.id ?? 'no-project'} project={project} /></>}
      {rightPanelTab === 'git' && <div className="placeholder"><GitCompare size={22} /><strong>3 changed files</strong><span>Diff preview will appear here.</span></div>}
      {rightPanelTab === 'terminal' && <div className="terminal-preview"><span>$ git status --short</span><b>M src/middleware/auth.ts</b><b>M src/routes/api.ts</b><i>█</i></div>}
    </div>
    <div className="context-card"><div className="panel-label">HANDOFF CONTEXT</div><strong>{context.objective}</strong><p>{context.currentState}</p><div>{context.nextSteps.map((step) => <span key={step}>{step}</span>)}</div></div>
  </aside>
}
