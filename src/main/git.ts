import { BrowserWindow, ipcMain } from 'electron'
import simpleGit, { SimpleGit, FileStatusResult } from 'simple-git'

export interface FileEntry {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  oldPath?: string
}

export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    const git = simpleGit(repoPath)
    return await git.checkIsRepo()
  } catch {
    return false
  }
}

function mapStatus(file: { index: string; working_dir: string }): FileEntry['status'] {
  const idx = file.index
  const wd = file.working_dir
  if (idx === 'R' || wd === 'R') return 'renamed'
  if (idx === 'A' || wd === 'A' || idx === '?' || wd === '?') return 'untracked'
  if (idx === 'D' || wd === 'D') return 'deleted'
  return 'modified'
}

export function registerGitHandlers(win: BrowserWindow, repoPath: string): void {
  const git: SimpleGit = simpleGit(repoPath)
  const prefix = `git:${win.id}:`

  ipcMain.handle(`${prefix}status`, async () => {
    const status = await git.status()
    const staged: FileEntry[] = []
    const unstaged: FileEntry[] = []
    const untracked: FileEntry[] = status.not_added.map((p) => ({
      path: p,
      status: 'untracked' as const
    }))

    for (const file of status.files) {
      if (status.not_added.includes(file.path)) continue

      const entry: FileEntry = {
        path: file.path,
        status: mapStatus(file)
      }

      if (file.index === 'R') {
        entry.status = 'renamed'
      }

      if (
        file.index &&
        file.index !== ' ' &&
        file.index !== '?' &&
        file.index !== '!'
      ) {
        staged.push({ ...entry, status: mapFileIndex(file.index) })
      }

      if (
        file.working_dir &&
        file.working_dir !== ' ' &&
        file.working_dir !== '?' &&
        file.working_dir !== '!'
      ) {
        unstaged.push({ ...entry, status: mapFileWorkdir(file.working_dir) })
      }
    }

    return { staged, unstaged, untracked }
  })

  ipcMain.handle(`${prefix}diff`, async (_e, filePath: string, staged: boolean) => {
    try {
      if (staged) {
        return await git.diff(['--cached', '--', filePath])
      } else {
        return await git.diff(['--', filePath])
      }
    } catch {
      // For untracked files, show the whole file as added
      try {
        const { readFile } = await import('fs/promises')
        const fullPath = require('path').join(repoPath, filePath)
        const content = await readFile(fullPath, 'utf-8')
        const lines = content.split('\n')
        const diffLines = lines.map((l) => `+${l}`).join('\n')
        return `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n${diffLines}`
      } catch {
        return ''
      }
    }
  })

  ipcMain.handle(`${prefix}stage`, async (_e, filePaths: string[]) => {
    await git.add(filePaths)
  })

  ipcMain.handle(`${prefix}unstage`, async (_e, filePaths: string[]) => {
    await git.reset(['HEAD', '--', ...filePaths])
  })

  ipcMain.handle(
    `${prefix}commit`,
    async (_e, summary: string, description?: string) => {
      try {
        const message = description ? `${summary}\n\n${description}` : summary
        await git.commit(message)
        return { success: true }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  ipcMain.handle(`${prefix}push`, async () => {
    try {
      await git.push()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(`${prefix}push-set-upstream`, async () => {
    try {
      const branch = (await git.branchLocal()).current
      await git.push(['--set-upstream', 'origin', branch])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(`${prefix}branch-info`, async () => {
    try {
      const branchLocal = await git.branchLocal()
      const name = branchLocal.current
      let ahead = 0
      let behind = 0
      let hasUpstream = false

      try {
        const status = await git.status()
        ahead = status.ahead
        behind = status.behind
        hasUpstream = status.tracking !== null && status.tracking !== ''
      } catch {
        // no tracking branch
      }

      return { name, ahead, behind, hasUpstream }
    } catch (err: any) {
      return { name: 'unknown', ahead: 0, behind: 0, hasUpstream: false }
    }
  })
}

function mapFileIndex(index: string): FileEntry['status'] {
  switch (index) {
    case 'M':
      return 'modified'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return 'modified'
  }
}

function mapFileWorkdir(wd: string): FileEntry['status'] {
  switch (wd) {
    case 'M':
      return 'modified'
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return 'modified'
  }
}
