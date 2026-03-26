import simpleGit, { SimpleGit, FileStatusResult } from 'simple-git'
import path from 'path'
import type { FileEntry, GitStatus, BranchInfo, GitResult } from '../../shared/types'

export async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    const git = simpleGit(repoPath)
    return await git.checkIsRepo()
  } catch {
    return false
  }
}

function mapFileIndex(index: string): FileEntry['status'] {
  switch (index) {
    case 'M': return 'modified'
    case 'A': return 'added'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    default: return 'modified'
  }
}

function mapFileWorkdir(wd: string): FileEntry['status'] {
  switch (wd) {
    case 'M': return 'modified'
    case 'A': return 'added'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    default: return 'modified'
  }
}

export function createGitService(repoPath: string) {
  const git: SimpleGit = simpleGit(repoPath)

  async function status(): Promise<GitStatus> {
    const s = await git.status()
    const staged: FileEntry[] = []
    const unstaged: FileEntry[] = []
    const untracked: FileEntry[] = s.not_added.map((p) => ({
      path: p,
      status: 'untracked' as const
    }))

    for (const file of s.files) {
      if (s.not_added.includes(file.path)) continue

      const entry: FileEntry = {
        path: file.path,
        status: 'modified'
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
  }

  /** Run a git command and return stdout (handles non-zero exit for --no-index) */
  async function runGit(...args: string[]): Promise<string> {
    const proc = Bun.spawn(['git', ...args], {
      cwd: repoPath,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    // --no-index exits 1 when differences found (not an error)
    if (exitCode === 0 || exitCode === 1) return stdout
    return ''
  }

  async function diff(filePath: string, staged: boolean): Promise<string> {
    try {
      if (staged) {
        // Staged: compare index to HEAD
        return await runGit('diff', '--cached', '--no-ext-diff', '--no-color', '--', filePath)
      }

      // 1) Try diff against HEAD — shows full change for tracked modified/deleted files
      const headDiff = await runGit('diff', 'HEAD', '--no-ext-diff', '--no-color', '--', filePath)
      if (headDiff.trim()) return headDiff

      // 2) File might be untracked — use --no-index against /dev/null
      const noIndexDiff = await runGit('diff', '--no-index', '--no-ext-diff', '--no-color', '--', '/dev/null', filePath)
      if (noIndexDiff.trim()) return noIndexDiff

      return ''
    } catch {
      return ''
    }
  }

  async function stage(filePaths: string[]): Promise<void> {
    await git.add(filePaths)
  }

  async function unstage(filePaths: string[]): Promise<void> {
    await git.reset(['HEAD', '--', ...filePaths])
  }

  async function commit(summary: string, description?: string): Promise<GitResult> {
    try {
      const message = description ? `${summary}\n\n${description}` : summary
      await git.commit(message)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async function push(): Promise<GitResult> {
    try {
      await git.push()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async function pushSetUpstream(): Promise<GitResult> {
    try {
      const branch = (await git.branchLocal()).current
      await git.push(['--set-upstream', 'origin', branch])
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async function branchInfo(): Promise<BranchInfo> {
    try {
      const branchLocal = await git.branchLocal()
      const name = branchLocal.current
      let ahead = 0
      let behind = 0
      let hasUpstream = false

      try {
        const s = await git.status()
        ahead = s.ahead
        behind = s.behind
        hasUpstream = s.tracking !== null && s.tracking !== ''
      } catch {
        // no tracking branch
      }

      return { name, ahead, behind, hasUpstream }
    } catch {
      return { name: 'unknown', ahead: 0, behind: 0, hasUpstream: false }
    }
  }

  return { status, diff, stage, unstage, commit, push, pushSetUpstream, branchInfo }
}
