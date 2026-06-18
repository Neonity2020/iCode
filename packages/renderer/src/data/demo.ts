import type { AgentRun, Project, ProjectContext, ProjectSession } from '@icode/shared'

export const projects: Project[] = [
  { id: 'p1', name: 'my-next-app', path: '~/Projects/my-next-app', branch: 'feature/auth', lastOpenedAt: '2026-06-18T10:00:00Z', status: 'changed' },
  { id: 'p2', name: 'ai-toolkit', path: '~/Projects/ai-toolkit', branch: 'main', lastOpenedAt: '2026-06-17T09:00:00Z', status: 'clean' },
  { id: 'p3', name: 'data-analytics', path: '~/Projects/data-analytics', branch: 'develop', lastOpenedAt: '2026-06-16T09:00:00Z', status: 'clean' },
]

export const sessions: ProjectSession[] = [
  { id: 's1', projectId: 'p1', title: 'Add auth middleware', createdAt: '2026-06-18T09:00:00Z', updatedAt: '2026-06-18T10:30:00Z' },
  { id: 's2', projectId: 'p1', title: 'Fix API bug', createdAt: '2026-06-17T09:00:00Z', updatedAt: '2026-06-17T11:30:00Z' },
  { id: 's3', projectId: 'p1', title: 'Refactor service', createdAt: '2026-06-16T09:00:00Z', updatedAt: '2026-06-16T11:30:00Z' },
]

export const runs: AgentRun[] = [
  {
    id: 'r1', projectId: 'p1', sessionId: 's1', agent: 'codex', status: 'completed',
    startedAt: '2026-06-18T09:05:00Z', endedAt: '2026-06-18T09:48:00Z', summary: 'Implemented JWT verification and route guards.',
    entries: [
      { id: 'e1', runId: 'r1', kind: 'prompt', content: '实现认证中间件，并为受保护路由添加 JWT 校验。', createdAt: '2026-06-18T09:05:00Z' },
      { id: 'e2', runId: 'r1', kind: 'response', content: 'I added the authentication middleware and wired it into the protected API routes. The remaining work is to cover refresh-token expiry and add integration tests.', createdAt: '2026-06-18T09:44:00Z' },
      { id: 'e3', runId: 'r1', kind: 'change', content: '3 files changed · +128 −14', createdAt: '2026-06-18T09:47:00Z' },
    ],
  },
  {
    id: 'r2', projectId: 'p1', sessionId: 's1', agent: 'claude', status: 'running', handoffFromRunId: 'r1',
    startedAt: '2026-06-18T10:02:00Z', summary: 'Continuing from Codex: refresh-token handling and tests.',
    entries: [
      { id: 'e4', runId: 'r2', kind: 'system', content: 'Handoff from Codex · context and Git state restored', createdAt: '2026-06-18T10:02:00Z' },
      { id: 'e5', runId: 'r2', kind: 'response', content: 'I reviewed the existing middleware and the handoff summary. I am adding refresh-token expiry coverage without changing the public API.', createdAt: '2026-06-18T10:08:00Z' },
    ],
  },
]

export const context: ProjectContext = {
  projectId: 'p1', objective: 'Ship JWT authentication middleware',
  currentState: 'Core middleware works. Refresh-token expiry and integration tests remain.',
  nextSteps: ['Add refresh-token expiry handling', 'Cover protected routes with integration tests'],
  relevantFiles: ['src/middleware/auth.ts', 'src/routes/api.ts', 'test/auth.test.ts'],
  updatedAt: '2026-06-18T10:02:00Z',
}
