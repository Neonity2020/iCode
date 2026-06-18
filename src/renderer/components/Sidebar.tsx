import { Box, ChevronRight, Clock3, FolderKanban, Plus } from 'lucide-react'
import { projects, sessions } from '../data/demo'
import { useWorkspaceStore } from '../stores/workspace'

export function Sidebar() {
  const { projectId, sessionId, setProject, setSession } = useWorkspaceStore()
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">i</span><strong>iCode</strong></div>
      <nav>
        <div className="section-title"><span>Projects</span><button aria-label="Open project"><Plus size={15} /></button></div>
        {projects.map((project) => (
          <button className={`nav-row ${project.id === projectId ? 'active' : ''}`} key={project.id} onClick={() => setProject(project.id)}>
            <FolderKanban size={16} /><span>{project.name}</span>{project.id === projectId && <ChevronRight size={14} />}
          </button>
        ))}
        <div className="section-title sessions-title"><span>Sessions</span><button aria-label="New session"><Plus size={15} /></button></div>
        {sessions.filter((session) => session.projectId === projectId).map((session) => (
          <button className={`nav-row session-row ${session.id === sessionId ? 'active' : ''}`} key={session.id} onClick={() => setSession(session.id)}>
            <Clock3 size={15} /><span>{session.title}</span>
          </button>
        ))}
      </nav>
      <div className="workspace-chip"><Box size={15} /><div><span>Workspace</span><small>Local repository</small></div><i className="online-dot" /></div>
    </aside>
  )
}
