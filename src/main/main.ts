import { app, BrowserWindow, dialog } from 'electron'
import started from 'electron-squirrel-startup'
import path from 'node:path'
import { registerIpcHandlers } from './ipc/register'
import { WorkspaceService } from './services/workspace-service'
import { SessionService } from './services/session-service'
import { CodexAppServerService } from './services/codex-app-server-service'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string

if (started) app.quit()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d0e11',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
}

app.whenReady().then(async () => {
  const workspaceService = new WorkspaceService()
  const sessionService = new SessionService(app.getPath('userData'), workspaceService)
  const codexService = new CodexAppServerService()

  try {
    await workspaceService.ensureDefaultRoot()
  } catch (error) {
    console.error('Failed to create the default iCode workspace', error)
    dialog.showErrorBox(
      'Workspace unavailable',
      `iCode could not create its default workspace at ${workspaceService.getDefaultRoot()}.`,
    )
  }

  registerIpcHandlers(workspaceService, sessionService, codexService)
  app.once('before-quit', () => codexService.dispose())
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
