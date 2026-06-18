import { ChevronRight, FileCode2, FileJson, FileText, Folder, GitCompare, TerminalSquare } from 'lucide-react'
import { context } from '../data/demo'
import { useWorkspaceStore } from '../stores/workspace'

const files = [
  { name: 'src', type: 'folder' }, { name: 'middleware', type: 'folder', indent: true },
  { name: 'auth.ts', type: 'code', indent: true }, { name: 'routes', type: 'folder' },
  { name: 'package.json', type: 'json' }, { name: 'README.md', type: 'text' },
]

export function RightPanel() {
  const { rightPanelTab, setRightPanelTab } = useWorkspaceStore()
  return <aside className="right-panel">
    <div className="tabs"><button className={rightPanelTab === 'files' ? 'active' : ''} onClick={() => setRightPanelTab('files')}><FileCode2 size={15} />Files</button><button className={rightPanelTab === 'git' ? 'active' : ''} onClick={() => setRightPanelTab('git')}><GitCompare size={15} />Git <b>3</b></button><button className={rightPanelTab === 'terminal' ? 'active' : ''} onClick={() => setRightPanelTab('terminal')}><TerminalSquare size={15} />Terminal</button></div>
    <div className="panel-content">
      {rightPanelTab === 'files' && <><div className="panel-label">MY-NEXT-APP</div><div className="file-tree">{files.map((file, index) => <div className={file.indent ? 'indent' : ''} key={`${file.name}-${index}`}>{file.type === 'folder' ? <><ChevronRight size={13} /><Folder size={15} /></> : file.type === 'json' ? <FileJson size={15} /> : file.type === 'text' ? <FileText size={15} /> : <FileCode2 size={15} />}<span>{file.name}</span></div>)}</div></>}
      {rightPanelTab === 'git' && <div className="placeholder"><GitCompare size={22} /><strong>3 changed files</strong><span>Diff preview will appear here.</span></div>}
      {rightPanelTab === 'terminal' && <div className="terminal-preview"><span>$ git status --short</span><b>M src/middleware/auth.ts</b><b>M src/routes/api.ts</b><i>█</i></div>}
    </div>
    <div className="context-card"><div className="panel-label">HANDOFF CONTEXT</div><strong>{context.objective}</strong><p>{context.currentState}</p><div>{context.nextSteps.map((step) => <span key={step}>{step}</span>)}</div></div>
  </aside>
}
