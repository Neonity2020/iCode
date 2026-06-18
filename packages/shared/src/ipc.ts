export const IPC_CHANNELS = {
  agentsList: 'agents:list',
  projectsList: 'projects:list',
  projectsCreate: 'projects:create',
  projectEntriesList: 'projects:entries:list',
  sessionsList: 'sessions:list',
  sessionsCreate: 'sessions:create',
  sessionRunsList: 'sessions:runs:list',
  codexRunStart: 'codex:run:start',
  codexRunInterrupt: 'codex:run:interrupt',
  codexRunEvent: 'codex:run:event',
  codexModelsList: 'codex:models:list',
  // Approval flow: main pushes a request, renderer resolves it via `respond`.
  codexApprovalRequest: 'codex:approval:request',
  codexApprovalRespond: 'codex:approval:respond',
} as const
