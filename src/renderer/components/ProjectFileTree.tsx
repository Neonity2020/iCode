import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FileCode2, FileJson, FileText, Folder } from 'lucide-react'
import type { Project, ProjectEntry } from '../../shared/types'

interface ProjectFileTreeProps {
  project: Project | undefined
}

const textExtensions = new Set(['.md', '.mdx', '.txt'])
const codeExtensions = new Set(['.c', '.cpp', '.css', '.go', '.html', '.java', '.js', '.jsx', '.py', '.rs', '.sh', '.ts', '.tsx'])

function extensionOf(fileName: string): string {
  const separator = fileName.lastIndexOf('.')
  return separator > 0 ? fileName.slice(separator).toLowerCase() : ''
}

function FileIcon({ name }: { name: string }) {
  const extension = extensionOf(name)
  if (extension === '.json') return <FileJson size={15} />
  if (textExtensions.has(extension)) return <FileText size={15} />
  return <FileCode2 className={codeExtensions.has(extension) ? 'code-file' : undefined} size={15} />
}

export function ProjectFileTree({ project }: ProjectFileTreeProps) {
  const [entriesByPath, setEntriesByPath] = useState<Record<string, ProjectEntry[]>>({})
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set(project ? [''] : []))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!project) return
    let cancelled = false
    const projectId = project.id
    void window.icode.projects.listEntries(projectId, '')
      .then((entries) => {
        if (!cancelled) setEntriesByPath({ '': entries })
      })
      .catch(() => {
        if (!cancelled) setError('Unable to read this project.')
      })
      .finally(() => {
        if (!cancelled) setLoadingPaths(new Set())
      })

    return () => { cancelled = true }
  }, [project])

  async function toggleDirectory(entry: ProjectEntry): Promise<void> {
    if (!project) return
    if (expandedPaths.has(entry.path)) {
      setExpandedPaths((current) => {
        const next = new Set(current)
        next.delete(entry.path)
        return next
      })
      return
    }

    setExpandedPaths((current) => new Set(current).add(entry.path))
    if (entriesByPath[entry.path]) return

    const projectId = project.id
    setLoadingPaths((current) => new Set(current).add(entry.path))
    try {
      const entries = await window.icode.projects.listEntries(projectId, entry.path)
      setEntriesByPath((current) => ({ ...current, [entry.path]: entries }))
    } catch {
      setError(`Unable to read ${entry.name}.`)
    } finally {
      setLoadingPaths((current) => {
        const next = new Set(current)
        next.delete(entry.path)
        return next
      })
    }
  }

  function renderEntries(parentPath: string, depth = 0): React.ReactNode {
    return entriesByPath[parentPath]?.map((entry) => {
      const isDirectory = entry.type === 'directory'
      const isExpanded = expandedPaths.has(entry.path)
      return <div key={entry.path}>
        <button
          className={`file-tree-row ${isDirectory ? 'directory' : 'file'}`}
          disabled={!isDirectory}
          onClick={() => void toggleDirectory(entry)}
          style={{ paddingLeft: 6 + depth * 16 }}
          title={entry.name}
        >
          {isDirectory ? <>{isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<Folder size={15} /></> : <><span className="file-tree-spacer" /><FileIcon name={entry.name} /></>}
          <span>{entry.name}</span>
        </button>
        {isDirectory && isExpanded && <>
          {loadingPaths.has(entry.path) && <div className="file-tree-message" style={{ paddingLeft: 27 + depth * 16 }}>Loading...</div>}
          {renderEntries(entry.path, depth + 1)}
        </>}
      </div>
    })
  }

  if (!project) return <div className="file-tree-message">Select a project to browse its files.</div>
  if (loadingPaths.has('')) return <div className="file-tree-message">Loading files...</div>
  if (error && !entriesByPath['']) return <div className="file-tree-message error">{error}</div>

  return <>
    {error && <div className="file-tree-message error">{error}</div>}
    {entriesByPath['']?.length === 0 && <div className="file-tree-message">This project is empty.</div>}
    <div className="file-tree">{renderEntries('')}</div>
  </>
}
