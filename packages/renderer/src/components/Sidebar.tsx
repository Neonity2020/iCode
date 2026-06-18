import { useState } from 'react'
import { Box, ChevronRight, Clock3, FolderKanban, Plus } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspace'
import { NewProjectDialog } from './NewProjectDialog'

export function Sidebar() {
  const { projects, sessions, projectId, sessionId, isLoadingProjects, isLoadingSessions, projectError, sessionError, setProject, setSession, beginSession } = useWorkspaceStore()
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  return (
    <>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">i</span><strong>iCode</strong></div>
      <nav>
        <div className="section-title"><span>Projects</span><button aria-label="New project" onClick={() => setIsNewProjectOpen(true)}><Plus size={15} /></button></div>
        {isLoadingProjects && <div className="project-list-message">Loading projects...</div>}
        {!isLoadingProjects && projects.length === 0 && !projectError && <div className="project-list-message">No projects yet</div>}
        {projectError && <div className="project-list-message error">Unable to load projects</div>}
        {projects.map((project) => (
          <button className={`nav-row ${project.id === projectId ? 'active' : ''}`} key={project.id} onClick={() => setProject(project.id)}>
            <FolderKanban size={16} /><span>{project.name}</span>{project.id === projectId && <ChevronRight size={14} />}
          </button>
        ))}
        <div className="section-title sessions-title"><span>Sessions</span><button aria-label="New session" disabled={!projectId} onClick={beginSession}><Plus size={15} /></button></div>
        {projectId && isLoadingSessions && <div className="project-list-message">Loading sessions...</div>}
        {projectId && !isLoadingSessions && sessions.length === 0 && !sessionError && <div className="project-list-message">No sessions yet</div>}
        {!projectId && <div className="project-list-message">Select a project first</div>}
        {sessionError && <div className="project-list-message error">Unable to load sessions</div>}
        {sessions.map((session) => (
          <button className={`nav-row session-row ${session.id === sessionId ? 'active' : ''}`} key={session.id} onClick={() => setSession(session.id)}>
            <Clock3 size={15} /><span>{session.title}</span>
          </button>
        ))}
      </nav>
      <div className="workspace-chip"><Box size={15} /><div><span>Workspace</span><small>Local repository</small></div><i className="online-dot" /></div>
    </aside>
    {isNewProjectOpen && <NewProjectDialog onClose={() => setIsNewProjectOpen(false)} />}
    </>
  )
}
