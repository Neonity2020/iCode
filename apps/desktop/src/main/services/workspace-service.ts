import { lstat, mkdir, readdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { Project, ProjectEntry } from '@icode/shared'

const DEFAULT_WORKSPACE_DIRECTORY = 'icode'
const INVALID_PROJECT_NAME_CHARACTERS = /[<>:"/\\|?*]/
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export class WorkspaceService {
  getDefaultRoot(): string {
    return path.join(homedir(), DEFAULT_WORKSPACE_DIRECTORY)
  }

  async ensureDefaultRoot(): Promise<string> {
    const workspaceRoot = this.getDefaultRoot()
    await mkdir(workspaceRoot, { recursive: true })
    return workspaceRoot
  }

  async listProjects(): Promise<Project[]> {
    const workspaceRoot = await this.ensureDefaultRoot()
    const entries = await readdir(workspaceRoot, { withFileTypes: true })
    const directories = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))

    const projects = await Promise.all(directories.map(async (entry) => {
      const projectPath = path.join(workspaceRoot, entry.name)
      const projectStat = await stat(projectPath)
      return this.toProject(entry.name, projectPath, projectStat.mtime.toISOString())
    }))

    return projects.sort((left, right) => left.name.localeCompare(right.name))
  }

  async createProject(rawName: string): Promise<Project> {
    const name = this.validateProjectName(rawName)
    const workspaceRoot = await this.ensureDefaultRoot()
    const projectPath = path.join(workspaceRoot, name)

    try {
      await mkdir(projectPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error(`A project named "${name}" already exists.`)
      }
      throw error
    }

    return this.toProject(name, projectPath, new Date().toISOString())
  }

  async listProjectEntries(projectId: string, relativePath: string): Promise<ProjectEntry[]> {
    const projectRoot = await this.resolveProjectRoot(projectId)
    const requestedPath = path.resolve(projectRoot, relativePath)
    const resolvedPath = await realpath(requestedPath)
    const pathWithinProject = path.relative(projectRoot, resolvedPath)

    if (pathWithinProject.startsWith(`..${path.sep}`) || pathWithinProject === '..' || path.isAbsolute(pathWithinProject)) {
      throw new Error('The requested directory is outside the project.')
    }

    const entries = await readdir(resolvedPath, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() || entry.isFile())
      .map((entry) => ({
        name: entry.name,
        path: path.join(relativePath, entry.name),
        type: entry.isDirectory() ? 'directory' as const : 'file' as const,
      }))
      .sort((left, right) => {
        if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
        return left.name.localeCompare(right.name)
      })
  }

  async resolveProjectRoot(projectId: string): Promise<string> {
    const workspaceRoot = await this.ensureDefaultRoot()
    const projectRoot = path.resolve(projectId)

    if (path.dirname(projectRoot) !== workspaceRoot) {
      throw new Error('The requested project is not in the iCode workspace.')
    }

    const projectStat = await lstat(projectRoot)
    if (!projectStat.isDirectory() || projectStat.isSymbolicLink()) {
      throw new Error('The requested project is not a valid directory.')
    }

    return realpath(projectRoot)
  }

  private validateProjectName(rawName: string): string {
    const name = rawName.trim()

    if (!name) throw new Error('Project name is required.')
    if (name.length > 80) throw new Error('Project name must be 80 characters or fewer.')
    if (name === '.' || name === '..') throw new Error('This project name is not allowed.')
    const hasControlCharacters = [...name].some((character) => character.charCodeAt(0) <= 31)
    if (name.endsWith('.') || hasControlCharacters || INVALID_PROJECT_NAME_CHARACTERS.test(name)) {
      throw new Error('Project name contains characters that are not allowed.')
    }
    if (RESERVED_WINDOWS_NAMES.test(name)) throw new Error('This project name is reserved by the operating system.')

    return name
  }

  private toProject(name: string, projectPath: string, lastOpenedAt: string): Project {
    return {
      id: projectPath,
      name,
      path: projectPath,
      branch: '',
      lastOpenedAt,
      status: 'unknown',
    }
  }
}
