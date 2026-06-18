import { useEffect, useState } from 'react'
import { ApprovalDialog } from './components/ApprovalDialog'
import { ResizeHandle } from './components/ResizeHandle'
import { RightPanel } from './components/RightPanel'
import { Sidebar } from './components/Sidebar'
import { Timeline } from './components/Timeline'
import { Toolbar } from './components/Toolbar'
import { useWorkspaceStore } from './stores/workspace'

const SIDEBAR_MIN_WIDTH = 160
const SIDEBAR_MAX_WIDTH = 400
const SIDEBAR_DEFAULT_WIDTH = 228
const RIGHT_PANEL_MIN_WIDTH = 240
const RIGHT_PANEL_MAX_WIDTH = 520
const RIGHT_PANEL_DEFAULT_WIDTH = 310
const RESIZE_HANDLE_WIDTH = 5

export default function App() {
  const loadProjects = useWorkspaceStore((state) => state.loadProjects)
  const loadSessions = useWorkspaceStore((state) => state.loadSessions)
  const projectId = useWorkspaceStore((state) => state.projectId)
  const sessionId = useWorkspaceStore((state) => state.sessionId)
  const loadRuns = useWorkspaceStore((state) => state.loadRuns)
  const applyCodexEvent = useWorkspaceStore((state) => state.applyCodexEvent)
  const setPendingApproval = useWorkspaceStore((state) => state.setPendingApproval)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_DEFAULT_WIDTH)

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
    <div
      className="app-shell"
      style={{ gridTemplateColumns: `${sidebarWidth}px ${RESIZE_HANDLE_WIDTH}px minmax(0, 1fr)` }}
    >
      <Sidebar />
      <ResizeHandle
        width={sidebarWidth}
        min={SIDEBAR_MIN_WIDTH}
        max={SIDEBAR_MAX_WIDTH}
        onResize={setSidebarWidth}
        side="left"
        label="Resize sidebar"
      />
      <section className="workspace">
        <Toolbar />
        <div
          className="work-area"
          style={{ gridTemplateColumns: `minmax(0, 1fr) ${RESIZE_HANDLE_WIDTH}px ${rightPanelWidth}px` }}
        >
          <Timeline />
          <ResizeHandle
            width={rightPanelWidth}
            min={RIGHT_PANEL_MIN_WIDTH}
            max={RIGHT_PANEL_MAX_WIDTH}
            onResize={setRightPanelWidth}
            side="right"
            label="Resize right panel"
          />
          <RightPanel />
        </div>
      </section>
      <ApprovalDialog />
    </div>
  )
}
