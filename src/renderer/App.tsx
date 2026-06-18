import { useEffect } from 'react'
import { ApprovalDialog } from './components/ApprovalDialog'
import { RightPanel } from './components/RightPanel'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { useWorkspaceStore } from './stores/workspace'

export default function App() {
  const loadProjects = useWorkspaceStore((state) => state.loadProjects)
  const loadSessions = useWorkspaceStore((state) => state.loadSessions)
  const projectId = useWorkspaceStore((state) => state.projectId)
  const sessionId = useWorkspaceStore((state) => state.sessionId)
  const loadRuns = useWorkspaceStore((state) => state.loadRuns)
  const applyCodexEvent = useWorkspaceStore((state) => state.applyCodexEvent)
  const setPendingApproval = useWorkspaceStore((state) => state.setPendingApproval)

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (projectId) void loadSessions(projectId)
  }, [loadSessions, projectId])

  useEffect(() => {
    if (sessionId) void loadRuns(sessionId)
  }, [loadRuns, sessionId])

  useEffect(() => window.icode.codex.onEvent(applyCodexEvent), [applyCodexEvent])

  // Surface mid-turn approval requests from Codex in the approval dialog.
  useEffect(() => window.icode.codex.onApprovalRequest(setPendingApproval), [setPendingApproval])

  return (
    <div className="app-shell">
      <Sidebar />
      <section className="workspace">
        <Toolbar />
        <div className="work-area">
          <Timeline />
          <RightPanel />
        </div>
      </section>
      <ApprovalDialog />
    </div>
  )
}
