import { ShieldCheck, Terminal, FileEdit, X } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspace'
import type { CodexApprovalDecision } from '@icode/shared'

export function ApprovalDialog() {
  const pendingApproval = useWorkspaceStore((state) => state.pendingApproval)
  const respondApproval = useWorkspaceStore((state) => state.respondApproval)

  if (!pendingApproval) return null

  const isCommand = pendingApproval.kind === 'command'
  const Icon = isCommand ? Terminal : FileEdit
  const heading = isCommand ? 'Codex wants to run a command' : 'Codex wants to change files'
  const subheading = isCommand
    ? 'Running commands can modify files. Approve to let Codex proceed.'
    : 'These edits will be written to your project. Approve to let Codex apply them.'

  const choose = (decision: CodexApprovalDecision) => {
    void respondApproval(decision)
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="project-dialog approval-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title">
        <div className="dialog-heading">
          <span className="dialog-icon"><Icon size={18} /></span>
          <div>
            <h2 id="approval-title">{heading}</h2>
            <p>{subheading}</p>
          </div>
          <button type="button" className="dialog-close" aria-label="Reject and close" onClick={() => choose('reject')}>
            <X size={16} />
          </button>
        </div>

        <div className="approval-summary">
          <code>{pendingApproval.summary}</code>
          {pendingApproval.details && <pre className="approval-details">{pendingApproval.details}</pre>}
        </div>

        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={() => choose('reject')}>Reject</button>
          <button type="button" className="secondary-button" onClick={() => choose('accept-once')}>Allow once</button>
          <button type="button" className="primary-button approval-trust" onClick={() => choose('accept-for-session')}>
            <ShieldCheck size={14} /> Allow for session
          </button>
        </div>
      </div>
    </div>
  )
}
