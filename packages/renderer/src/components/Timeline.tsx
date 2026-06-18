import { ArrowDown, Bot, FileCode2, Loader2, MessagesSquare, Send, Sparkles, Square } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type UIEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import type { AgentRun } from '@icode/shared'
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
  const {
    sessions, runs, sessionId, selectedAgent, selectedModel, availableModels,
    isLoadingModels, isStartingRun, runError,
    startCodexRun, interruptRun, setModel, loadAvailableModels,
  } = useWorkspaceStore()
  const [prompt, setPrompt] = useState('')
  const timelineRef = useRef<HTMLDivElement>(null)
  const shouldFollowOutput = useRef(true)
  const session = sessions.find((item) => item.id === sessionId)
  const activeRun = runs.find((run) => run.status === 'running')
  const latestEntry = runs.at(-1)?.entries.at(-1)

  useEffect(() => {
    shouldFollowOutput.current = true
    timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight })
  }, [sessionId])

  useEffect(() => {
    if (!shouldFollowOutput.current) return
    const frame = requestAnimationFrame(() => {
      timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight })
    })
    return () => cancelAnimationFrame(frame)
  }, [runs.length, latestEntry?.content, isStartingRun])

  // Prime the model catalog once on mount; the result is cached in the main process
  // so the request only spins up the Codex app-server on first call.
  useEffect(() => {
    void loadAvailableModels()
  }, [loadAvailableModels])

  function handleTimelineScroll(event: UIEvent<HTMLDivElement>) {
    const timeline = event.currentTarget
    shouldFollowOutput.current = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight < 80
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!prompt.trim() || activeRun || isStartingRun) return
    shouldFollowOutput.current = true
    try {
      await startCodexRun(prompt, { model: selectedModel })
      setPrompt('')
    } catch {
      // The store exposes the runtime error beside the composer.
    }
  }

  const hasModels = availableModels.length > 0

  return <main className="timeline-shell">
    <div className="timeline-title"><div><span>Project timeline</span><h2>{session?.title ?? 'New session'}</h2></div><button className="context-button"><Sparkles size={15} /> Project context</button></div>
    <div className="timeline" ref={timelineRef} onScroll={handleTimelineScroll}>
      {isStartingRun && <div className="timeline-empty"><Bot className="starting-icon" size={22} /><strong>Starting Codex</strong><span>Connecting to the local Codex CLI in workspace-write mode...</span></div>}
      {!isStartingRun && session && runs.length === 0 && <div className="timeline-empty"><Bot size={22} /><strong>No agent runs yet</strong><span>This session has no saved Codex runs.</span></div>}
      {!isStartingRun && !session && <div className="timeline-empty"><Sparkles size={22} /><strong>Start with a prompt</strong><span>Your first message creates the Session and its Codex Thread automatically.</span></div>}
      {runs.map((run, index) => <div key={run.id}>{index > 0 && <div className="handoff"><span /><div><MessagesSquare size={14} /> Conversation turn</div><span /></div>}<RunCard run={run} /></div>)}
    </div>
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer-meta">
        <span className={`agent-dot ${selectedAgent}`} /> {session ? `Session with ${agentLabels[selectedAgent]}` : `New session with ${agentLabels[selectedAgent]}`}
        <span>Workspace-write sandbox</span>
        <select
          className={`model-picker${isLoadingModels || !hasModels ? ' loading' : ''}`}
          value={selectedModel}
          onChange={(event) => setModel(event.currentTarget.value)}
          disabled={Boolean(activeRun) || isStartingRun || isLoadingModels || !hasModels}
          aria-label="Codex model"
          title={isLoadingModels ? 'Loading Codex models…' : 'Codex model — only used when this run starts a new thread'}
        >
          {isLoadingModels && (
            <option value={selectedModel}>Loading models…</option>
          )}
          {!isLoadingModels && !hasModels && (
            <option value={selectedModel}>No models available</option>
          )}
          {hasModels && availableModels.map((model) => (
            <option key={model.id} value={model.id}>{model.displayName}{model.isDefault ? ' · default' : ''}</option>
          ))}
        </select>
        {isLoadingModels && <Loader2 size={11} className="model-picker-spinner" aria-hidden="true" />}
      </div>
      {runError && <div className="composer-error" role="alert">{runError}</div>}
      <div className="composer-input">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={session ? 'Continue this conversation with Codex...' : 'Ask Codex about this project...'}
          rows={2}
          disabled={Boolean(activeRun) || isStartingRun}
        />
        <button type="button" className="stop-button" aria-label="Stop agent" disabled={!activeRun} onClick={() => activeRun && void interruptRun(activeRun.id)}><Square size={14} /></button>
        <button type="submit" className="send-button" aria-label="Send" disabled={Boolean(activeRun) || isStartingRun || !prompt.trim()}><Send size={17} /></button>
      </div>
    </form>
  </main>
}
