import path from 'node:path'
import { getShellEnv } from './shell-env'
import { getConfig } from './config'
import type { Worktree, WorktreeStatus, SetupCommandResult, GitStatus, FileEntry, BranchInfo, GitResult, MergeConflictInfo } from '../../shared/types'

const MAIN_BRANCH_NAMES = new Set(['main', 'master', 'develop', 'trunk'])

async function git(args: string[], cwd: string, stdin?: string): Promise<string> {
  const env = await getShellEnv()
  const spawnOpts: Record<string, unknown> = { cwd, stdout: 'pipe', stderr: 'pipe', env }
  if (stdin !== undefined) {
    spawnOpts.stdin = new Blob([stdin])
  }
  const proc = Bun.spawn(['git', ...args], spawnOpts)
  const stdout = await new Response(proc.stdout as ReadableStream).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr as ReadableStream).text()
    throw new Error(stderr.trim() || `git ${args[0]} exited with code ${exitCode}`)
  }
  return stdout
}

async function gitSilent(args: string[], cwd: string): Promise<string | null> {
  try {
    return await git(args, cwd)
  } catch {
    return null
  }
}

/** Run a git command allowing exit code 1 (used for diff --no-index). */
async function gitDiff(args: string[], cwd: string): Promise<string> {
  const env = await getShellEnv()
  const proc = Bun.spawn(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe', env })
  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode === 0 || exitCode === 1) return stdout
  return ''
}

// --- Worktree management (ported from treebeard) ---

function parseWorktreeOutput(output: string): Worktree[] {
  const worktrees: Worktree[] = []
  const blocks = output.trim().split('\n\n')

  for (const block of blocks) {
    if (!block.trim()) continue

    const lines = block.trim().split('\n')
    let wtPath = ''
    let head = ''
    let branch = ''
    let isBare = false

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wtPath = line.slice('worktree '.length)
      } else if (line.startsWith('HEAD ')) {
        head = line.slice('HEAD '.length)
      } else if (line.startsWith('branch ')) {
        branch = line.slice('branch '.length).replace('refs/heads/', '')
      } else if (line === 'bare') {
        isBare = true
      } else if (line === 'detached') {
        branch = '(detached)'
      }
    }

    if (isBare) continue

    worktrees.push({
      path: wtPath,
      branch,
      head,
      isMain: MAIN_BRANCH_NAMES.has(branch)
    })
  }

  return worktrees
}

export async function getWorktrees(repoPath: string): Promise<Worktree[]> {
  const stdout = await git(['worktree', 'list', '--porcelain'], repoPath)
  return parseWorktreeOutput(stdout)
}

export async function getGitHubRepo(repoPath: string): Promise<string | null> {
  const stdout = await gitSilent(['remote', 'get-url', 'origin'], repoPath)
  if (!stdout) return null

  const url = stdout.trim()
  const sshMatch = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)
  if (sshMatch) return sshMatch[1]

  const httpsMatch = url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)
  if (httpsMatch) return httpsMatch[1]

  return null
}

export async function getDefaultBranch(repoPath: string): Promise<string> {
  const stdout = await gitSilent(
    ['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'],
    repoPath
  )
  if (stdout) return stdout.trim().replace(/^origin\//, '')

  for (const name of ['main', 'master']) {
    const result = await gitSilent(['rev-parse', '--verify', name], repoPath)
    if (result) return name
  }
  return 'main'
}

export async function getRemoteBranches(repoPath: string): Promise<string[]> {
  await gitSilent(['fetch', '--prune', 'origin'], repoPath)

  const stdout = await git(
    ['branch', '-r', '--format=%(refname:short)'],
    repoPath
  )

  const worktrees = await getWorktrees(repoPath)
  const usedBranches = new Set(worktrees.map((wt) => wt.branch))

  return stdout
    .trim()
    .split('\n')
    .filter((line) => line && !line.includes('->'))
    .map((ref) => ref.replace(/^origin\//, ''))
    .filter((branch) => !usedBranches.has(branch))
    .sort()
}

export function buildWorktreePath(repoName: string, branch: string): string {
  const config = getConfig()
  const basePath = config.worktreeBasePath
  const slug = repoName.toLowerCase().replace(/\s+/g, '-')
  return path.join(basePath, slug, branch)
}

export async function getWorktreeStatus(worktreePath: string): Promise<WorktreeStatus> {
  let hasUncommittedChanges = false
  let unpushedCommits = 0
  let unpulledCommits = 0
  let linesAdded = 0
  let linesDeleted = 0

  const statusOut = await gitSilent(['status', '--porcelain'], worktreePath)
  hasUncommittedChanges = statusOut ? statusOut.trim().length > 0 : true

  const diffOut = await gitSilent(['diff', '--numstat', 'HEAD'], worktreePath)
  if (diffOut) {
    for (const line of diffOut.trim().split('\n').filter(Boolean)) {
      const [added, deleted] = line.split('\t')
      linesAdded += parseInt(added) || 0
      linesDeleted += parseInt(deleted) || 0
    }
  }

  // Also count lines in untracked files (new files not yet staged)
  const untrackedOut = await gitSilent(
    ['ls-files', '--others', '--exclude-standard'],
    worktreePath
  )
  if (untrackedOut) {
    for (const relPath of untrackedOut.trim().split('\n').filter(Boolean)) {
      try {
        const fullPath = path.join(worktreePath, relPath)
        const content = await Bun.file(fullPath).text()
        const lineCount = content ? content.split('\n').length : 0
        linesAdded += lineCount
      } catch {
        // Skip files that can't be read (e.g. broken symlinks)
      }
    }
  }

  const pushOut = await gitSilent(['log', '@{u}..', '--oneline'], worktreePath)
  if (pushOut) {
    const lines = pushOut.trim().split('\n').filter(Boolean)
    unpushedCommits = lines.length
  }

  const pullOut = await gitSilent(['log', '..@{u}', '--oneline'], worktreePath)
  if (pullOut) {
    const lines = pullOut.trim().split('\n').filter(Boolean)
    unpulledCommits = lines.length
  }

  return { hasUncommittedChanges, unpushedCommits, unpulledCommits, linesAdded, linesDeleted }
}

export async function fetchRepo(repoPath: string): Promise<void> {
  await gitSilent(['fetch', '--prune', 'origin'], repoPath)
}

export async function pullWorktree(worktreePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    await git(['pull'], worktreePath)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force = false
): Promise<{ success: boolean; error?: string }> {
  const args = ['worktree', 'remove', worktreePath]
  if (force) args.push('--force')
  try {
    await git(args, repoPath)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function addWorktree(
  repoPath: string,
  branch: string,
  worktreePath: string,
  isNewBranch: boolean,
  baseBranch?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const args = ['worktree', 'add']

    if (isNewBranch) {
      args.push('-b', branch, worktreePath, baseBranch || 'main')
    } else {
      args.push(worktreePath, branch)
    }

    await git(args, repoPath)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

const SETUP_COMMAND_TIMEOUT_MS = 300_000

export async function runSetupCommands(
  worktreePath: string,
  commands: string[]
): Promise<{ results: SetupCommandResult[]; allSucceeded: boolean }> {
  const shell = Bun.env.SHELL || '/bin/zsh'
  const env = await getShellEnv()
  const results: SetupCommandResult[] = []

  for (const command of commands) {
    try {
      const proc = Bun.spawn([shell, '-ilc', command], {
        cwd: worktreePath,
        stdout: 'pipe',
        stderr: 'pipe',
        env
      })

      const timer = setTimeout(() => proc.kill(), SETUP_COMMAND_TIMEOUT_MS)
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited
      clearTimeout(timer)

      const output = (stdout + stderr).trim()

      if (exitCode !== 0) {
        results.push({ command, success: false, output })
        return { results, allSucceeded: false }
      }

      results.push({ command, success: true, output })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ command, success: false, output: message })
      return { results, allSucceeded: false }
    }
  }

  return { results, allSucceeded: true }
}

// --- Diff panel operations (using Bun.spawn) ---

function mapStatusCode(code: string): FileEntry['status'] {
  switch (code) {
    case 'M': return 'modified'
    case 'A': return 'added'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    default: return 'modified'
  }
}

export async function getGitStatus(worktreePath: string): Promise<GitStatus> {
  const stdout = await git(['status', '--porcelain', '-uall'], worktreePath)
  const staged: FileEntry[] = []
  const unstaged: FileEntry[] = []
  const untracked: FileEntry[] = []

  for (const line of stdout.split('\n').filter(Boolean)) {
    const index = line[0]
    const workdir = line[1]
    let filePath = line.slice(3)

    // Renamed/copied entries use "old_path -> new_path" format
    if ((index === 'R' || index === 'C' || workdir === 'R' || workdir === 'C') && filePath.includes(' -> ')) {
      filePath = filePath.slice(filePath.indexOf(' -> ') + 4)
    }

    if (index === '?' && workdir === '?') {
      untracked.push({ path: filePath, status: 'untracked' })
      continue
    }

    if (index && index !== ' ' && index !== '?' && index !== '!') {
      staged.push({ path: filePath, status: mapStatusCode(index) })
    }

    if (workdir && workdir !== ' ' && workdir !== '?' && workdir !== '!') {
      unstaged.push({ path: filePath, status: mapStatusCode(workdir) })
    }
  }

  return { staged, unstaged, untracked }
}

export async function getFileDiff(worktreePath: string, filePath: string, staged: boolean): Promise<string> {
  try {
    if (staged) {
      return await gitDiff(['diff', '--cached', '--no-ext-diff', '--no-color', '--', filePath], worktreePath)
    }

    const headDiff = await gitDiff(['diff', 'HEAD', '--no-ext-diff', '--no-color', '--', filePath], worktreePath)
    if (headDiff.trim()) return headDiff

    const noIndexDiff = await gitDiff(['diff', '--no-index', '--no-ext-diff', '--no-color', '--', '/dev/null', filePath], worktreePath)
    if (noIndexDiff.trim()) return noIndexDiff

    return ''
  } catch {
    return ''
  }
}

/**
 * Stage files using git update-index (like GitHub Desktop).
 * Unlike `git add`, update-index correctly handles deleted files,
 * renames, and paths with special characters via NUL-delimited stdin.
 */
export async function stageFiles(worktreePath: string, filePaths: string[]): Promise<void> {
  if (filePaths.length === 0) return

  // Step 1: Update index for all paths (new, modified, renamed destinations, deletions)
  await git(
    ['update-index', '--add', '--remove', '--replace', '-z', '--stdin'],
    worktreePath,
    filePaths.join('\0'),
  )

  // Step 2: Force-remove files deleted from the working tree.
  // update-index --remove handles most deletions, but --force-remove
  // is needed for edge cases (e.g. file replaced by directory).
  const deletedPaths: string[] = []
  for (const fp of filePaths) {
    const fullPath = path.join(worktreePath, fp)
    if (!await Bun.file(fullPath).exists()) {
      deletedPaths.push(fp)
    }
  }

  if (deletedPaths.length > 0) {
    await git(
      ['update-index', '--force-remove', '-z', '--stdin'],
      worktreePath,
      deletedPaths.join('\0'),
    )
  }
}

export async function unstageFiles(worktreePath: string, filePaths: string[]): Promise<void> {
  await git(['reset', 'HEAD', '--', ...filePaths], worktreePath)
}

export async function commitChanges(worktreePath: string, summary: string, description?: string): Promise<GitResult> {
  try {
    const message = description ? `${summary}\n\n${description}` : summary
    await git(['commit', '-m', message], worktreePath)
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
}

export async function pushChanges(worktreePath: string): Promise<GitResult> {
  try {
    // Try normal push first
    await git(['push'], worktreePath)
    return { success: true }
  } catch {
    // If no upstream, try push --set-upstream
    try {
      const branchOut = await git(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath)
      const branch = branchOut.trim()
      await git(['push', '--set-upstream', 'origin', branch], worktreePath)
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }
}

// Throttled fetch per branch to keep tracking refs fresh
const branchFetchTimestamps = new Map<string, number>()
const BRANCH_FETCH_THROTTLE_MS = 30_000

export async function getBranchInfo(worktreePath: string): Promise<BranchInfo> {
  try {
    const branchOut = await git(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath)
    const name = branchOut.trim()
    let ahead = 0
    let behind = 0
    let hasUpstream = false

    // Throttled fetch so tracking refs stay reasonably fresh (max once per 30s per branch)
    const now = Date.now()
    const key = `${worktreePath}:${name}`
    const lastFetch = branchFetchTimestamps.get(key) || 0
    if (now - lastFetch > BRANCH_FETCH_THROTTLE_MS) {
      await gitSilent(['fetch', 'origin', name, '--quiet'], worktreePath)
      branchFetchTimestamps.set(key, now)
    }

    const trackingOut = await gitSilent(['rev-parse', '--abbrev-ref', '@{u}'], worktreePath)
    if (trackingOut && trackingOut.trim()) {
      hasUpstream = true
      const countOut = await gitSilent(['rev-list', '--left-right', '--count', '@{u}...HEAD'], worktreePath)
      if (countOut) {
        const [behindStr, aheadStr] = countOut.trim().split('\t')
        behind = parseInt(behindStr) || 0
        ahead = parseInt(aheadStr) || 0
      }
    } else {
      // No tracking configured — check if branch already exists on the remote
      const remoteBranch = await gitSilent(['rev-parse', '--verify', `origin/${name}`], worktreePath)
      if (remoteBranch && remoteBranch.trim()) {
        // Auto-set tracking so future checks are accurate
        await gitSilent(['branch', '--set-upstream-to', `origin/${name}`, name], worktreePath)
        hasUpstream = true
        const countOut = await gitSilent(['rev-list', '--left-right', '--count', `origin/${name}...HEAD`], worktreePath)
        if (countOut) {
          const [behindStr, aheadStr] = countOut.trim().split('\t')
          behind = parseInt(behindStr) || 0
          ahead = parseInt(aheadStr) || 0
        }
      }
    }

    return { name, ahead, behind, hasUpstream }
  } catch {
    return { name: 'unknown', ahead: 0, behind: 0, hasUpstream: false }
  }
}

// --- Merge conflict detection ---

const MERGE_CONFLICT_THROTTLE_MS = 60_000
const mergeConflictCache = new Map<string, { result: MergeConflictInfo; timestamp: number }>()

export async function getMergeConflicts(
  worktreePath: string,
  repoPath: string
): Promise<MergeConflictInfo> {
  const defaultBranch = await getDefaultBranch(repoPath)
  const noConflicts: MergeConflictInfo = { hasConflicts: false, conflictCount: 0, conflictFiles: [], targetBranch: defaultBranch }

  try {
    // Check if current branch IS the default branch — skip detection
    const branchOut = await gitSilent(['rev-parse', '--abbrev-ref', 'HEAD'], worktreePath)
    if (branchOut && branchOut.trim() === defaultBranch) return noConflicts

    const targetRef = `origin/${defaultBranch}`

    // Verify the target ref exists
    const targetExists = await gitSilent(['rev-parse', '--verify', targetRef], worktreePath)
    if (!targetExists) return noConflicts

    // Throttle: reuse cached result if still fresh
    const cacheKey = `${worktreePath}:${targetRef}`
    const cached = mergeConflictCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < MERGE_CONFLICT_THROTTLE_MS) {
      return cached.result
    }

    // Use git merge-tree to perform a virtual merge (no working tree changes)
    const env = await getShellEnv()
    const proc = Bun.spawn(
      ['git', 'merge-tree', '--write-tree', 'HEAD', targetRef],
      { cwd: worktreePath, stdout: 'pipe', stderr: 'pipe', env }
    )
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited

    if (exitCode === 0) {
      mergeConflictCache.set(cacheKey, { result: noConflicts, timestamp: Date.now() })
      return noConflicts
    }

    // Parse CONFLICT lines — e.g. "CONFLICT (content): Merge conflict in <path>"
    const conflictFiles = stdout
      .split('\n')
      .filter(line => line.startsWith('CONFLICT'))
      .map(line => {
        const match = line.match(/Merge conflict in (.+)$/)
        return match ? match[1] : null
      })
      .filter((f): f is string => f !== null)

    const result: MergeConflictInfo = {
      hasConflicts: conflictFiles.length > 0,
      conflictCount: conflictFiles.length,
      conflictFiles,
      targetBranch: defaultBranch
    }

    mergeConflictCache.set(cacheKey, { result, timestamp: Date.now() })
    return result
  } catch {
    return noConflicts
  }
}
