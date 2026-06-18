import { ArrowDown, ArrowUpRight, Bot, FileCode2, Send, Sparkles, Square } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { AgentRun } from '../../shared/types'
import { runs, sessions } from '../data/demo'
import { useWorkspaceStore } from '../stores/workspace'

const agentLabels = { codex: 'Codex', claude: 'Claude Code', opencode: 'OpenCode' }

function RunCard({ run }: { run: AgentRun }) {
  return <article className="run-card">
    <div className="run-head"><span className={`agent-icon ${run.agent}`}><Bot size={16} /></span><div><strong>{agentLabels[run.agent]}</strong><small>{run.status} · {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div><span className={`status-pill ${run.status}`}>{run.status}</span></div>
    {run.entries.map((entry) => <div className={`entry ${entry.kind}`} key={entry.id}>
      {entry.kind === 'change' && <FileCode2 size={15} />}
      {entry.kind === 'system' && <ArrowDown size={15} />}
      {entry.kind === 'response' ? <ReactMarkdown>{entry.content}</ReactMarkdown> : <span>{entry.content}</span>}
    </div>)}
  </article>
}

export function Timeline() {
  const { sessionId, selectedAgent } = useWorkspaceStore()
  const session = sessions.find((item) => item.id === sessionId)
  const visibleRuns = runs.filter((run) => run.sessionId === sessionId)
  return <main className="timeline-shell">
    <div className="timeline-title"><div><span>Project timeline</span><h2>{session?.title ?? 'New session'}</h2></div><button className="context-button"><Sparkles size={15} /> Project context</button></div>
    <div className="timeline">
      {visibleRuns.map((run, index) => <div key={run.id}>{index > 0 && <div className="handoff"><span /><div><ArrowUpRight size={14} /> Agent handoff</div><span /></div>}<RunCard run={run} /></div>)}
    </div>
    <div className="composer"><div className="composer-meta"><span className={`agent-dot ${selectedAgent}`} /> Continue with {agentLabels[selectedAgent]}<span>Context attached</span></div><div className="composer-input"><textarea placeholder="Ask the agent to continue working on this project..." rows={2} /><button className="stop-button" aria-label="Stop agent"><Square size={14} /></button><button className="send-button" aria-label="Send"><Send size={17} /></button></div></div>
  </main>
}
