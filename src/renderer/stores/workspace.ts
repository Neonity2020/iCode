import { create } from 'zustand'
import type { AgentType } from '../../shared/types'

type RightPanelTab = 'files' | 'git' | 'terminal'

interface WorkspaceState {
  projectId: string
  sessionId: string
  selectedAgent: AgentType
  rightPanelTab: RightPanelTab
  setProject: (projectId: string) => void
  setSession: (sessionId: string) => void
  setAgent: (agent: AgentType) => void
  setRightPanelTab: (tab: RightPanelTab) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  projectId: 'p1',
  sessionId: 's1',
  selectedAgent: 'claude',
  rightPanelTab: 'files',
  setProject: (projectId) => set({ projectId }),
  setSession: (sessionId) => set({ sessionId }),
  setAgent: (selectedAgent) => set({ selectedAgent }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
}))
