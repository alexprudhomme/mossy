import chokidar, { FSWatcher } from 'chokidar'
import path from 'path'
import fs from 'fs'

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

export function createWatcher(repoPath: string, onChange: () => void): FSWatcher {
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

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const sendRefresh = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(onChange, 500)
  }

  watcher.on('change', sendRefresh)
  watcher.on('add', sendRefresh)
  watcher.on('unlink', sendRefresh)

  return watcher
}
