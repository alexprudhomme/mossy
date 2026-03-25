import { BrowserWindow } from 'electron'
import chokidar, { FSWatcher } from 'chokidar'
import path from 'path'
import fs from 'fs'

const watchers = new Map<BrowserWindow, FSWatcher>()
let debounceTimers = new Map<BrowserWindow, NodeJS.Timeout>()

function resolveGitDir(repoPath: string): string | null {
  const gitPath = path.join(repoPath, '.git')
  try {
    const stat = fs.statSync(gitPath)
    if (stat.isDirectory()) {
      return gitPath
    }
    // Worktree: .git is a file pointing to the real gitdir
    const content = fs.readFileSync(gitPath, 'utf-8').trim()
    const match = content.match(/^gitdir:\s*(.+)$/)
    if (match) {
      const gitdir = match[1]
      return path.isAbsolute(gitdir) ? gitdir : path.resolve(repoPath, gitdir)
    }
  } catch {
    // ignore
  }
  return null
}

export function startWatcher(win: BrowserWindow, repoPath: string): void {
  const gitDir = resolveGitDir(repoPath)
  const watchPaths = [repoPath]
  if (gitDir) {
    watchPaths.push(path.join(gitDir, 'index'))
    watchPaths.push(path.join(gitDir, 'HEAD'))
  }

  const watcher = chokidar.watch(watchPaths, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/out/**',
      '**/.DS_Store'
    ],
    ignoreInitial: true,
    persistent: true
  })

  const sendRefresh = (): void => {
    const existing = debounceTimers.get(win)
    if (existing) clearTimeout(existing)
    debounceTimers.set(
      win,
      setTimeout(() => {
        if (!win.isDestroyed()) {
          win.webContents.send('files:changed')
        }
      }, 500)
    )
  }

  watcher.on('change', sendRefresh)
  watcher.on('add', sendRefresh)
  watcher.on('unlink', sendRefresh)

  watchers.set(win, watcher)
}

export function stopWatcher(win: BrowserWindow): void {
  const watcher = watchers.get(win)
  if (watcher) {
    watcher.close()
    watchers.delete(win)
  }
  const timer = debounceTimers.get(win)
  if (timer) {
    clearTimeout(timer)
    debounceTimers.delete(win)
  }
}
