import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { registerGitHandlers, isGitRepo } from './git'
import { startWatcher, stopWatcher } from './watcher'

const windows = new Map<BrowserWindow, string>()

// Handler to let renderer know its window ID for IPC prefixing
ipcMain.handle('get-window-id', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win?.id ?? -1
})

function parseRepoPath(): string | null {
  const args = process.argv.slice(app.isPackaged ? 1 : 2)
  const rawPath = args.find((a) => !a.startsWith('-'))
  if (!rawPath) return null
  return path.resolve(rawPath)
}

async function createWindow(repoPath: string): Promise<void> {
  const isRepo = await isGitRepo(repoPath)
  if (!isRepo) {
    dialog.showErrorBox('Not a git repository', `"${repoPath}" is not a git repository.`)
    if (windows.size === 0) app.quit()
    return
  }

  const folderName = path.basename(repoPath)

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: folderName,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--repo-path=${repoPath}`]
    }
  })

  windows.set(win, repoPath)
  registerGitHandlers(win, repoPath)
  startWatcher(win, repoPath)

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    stopWatcher(win)
    windows.delete(win)
    if (windows.size === 0) app.quit()
  })
}

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const rawPath = argv.slice(app.isPackaged ? 1 : 2).find((a) => !a.startsWith('-'))
    if (rawPath) {
      createWindow(path.resolve(rawPath))
    }
  })

  app.whenReady().then(() => {
    const repoPath = parseRepoPath()
    if (!repoPath) {
      dialog.showErrorBox('Usage', 'Usage: gitpeek <path-to-repo>')
      app.quit()
      return
    }
    createWindow(repoPath)
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
