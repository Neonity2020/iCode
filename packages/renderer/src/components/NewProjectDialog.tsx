import { useState, type FormEvent } from 'react'
import { FolderPlus, X } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspace'

interface NewProjectDialogProps {
  onClose: () => void
}

export function NewProjectDialog({ onClose }: NewProjectDialogProps) {
  const createProject = useWorkspaceStore((state) => state.createProject)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsCreating(true)

    try {
      await createProject(name)
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create the project.')
      setIsCreating(false)
    }
  }

  return <div className="dialog-backdrop" role="presentation">
    <form className="project-dialog" onSubmit={handleSubmit}>
      <div className="dialog-heading">
        <span className="dialog-icon"><FolderPlus size={18} /></span>
        <div><h2>New project</h2><p>Create a folder in ~/icode</p></div>
        <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
      </div>
      <label htmlFor="project-name">Project name</label>
      <input id="project-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="my-new-project" maxLength={80} disabled={isCreating} />
      <small className="path-preview">~/icode/{name.trim() || 'project-name'}</small>
      {error && <div className="dialog-error" role="alert">{error}</div>}
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={isCreating}>Cancel</button>
        <button type="submit" className="primary-button" disabled={isCreating || !name.trim()}>{isCreating ? 'Creating...' : 'Create project'}</button>
      </div>
    </form>
  </div>
}
