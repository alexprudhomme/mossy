import path from 'node:path'
import fs from 'node:fs'
import { getShellEnv } from './shell-env'
import { getGitHubRepo } from './git'
import { getStacksForBranches } from './github'
import type { StackBranchInfo, StackInfo } from '../../shared/types'

/**
 * Stack detection for `gh stack`.
 *
 * Primary source is GitHub's stacked-PR API (see `getStacksForBranches`), which
 * is authoritative and independent of local state. This module adds caching and
 * a local fallback that reads the gh-stack state files from the git directory.
 *
 * The fallback exists because the API is in public preview and because the
 * files are the only thing that works offline. Reading the files is not
 * straightforward: `gh stack view --json` only works when the current branch is
 * part of a stack, so it cannot enumerate a repository's stacks, and each
 * worktree that ran a `gh stack` command keeps its own copy of the state at
 * `<git-dir>/gh-stack`. Those copies drift — a copy written before
 * `gh stack submit` has no stack id/number and no per-branch head — so every
 * copy is read and merged.
 */

const STACK_FILE = 'gh-stack'
const CACHE_TTL_MS = 60_000

interface CacheEntry {
  stacks: StackInfo[]
  timestamp: number
}

const stackCache = new Map<string, CacheEntry>()

/** Shape of the on-disk gh-stack file (schemaVersion 1). */
interface RawStackFile {
  schemaVersion?: number
  repository?: string
  stacks?: RawStack[]
}

interface RawStack {
  id?: string
  number?: number
  trunk?: { branch?: string; head?: string }
  branches?: RawStackBranch[]
}

interface RawStackBranch {
  branch?: string
  head?: string
  base?: string
  pullRequest?: { number?: number; id?: string; url?: string }
}

/** A parsed stack plus the mtime of the file it came from, used to break ties. */
interface TimestampedStack {
  stack: StackInfo
  mtimeMs: number
}

/**
 * Resolve the shared git directory for a repo. Returns the `.git` directory of
 * the primary checkout even when `repoPath` is a linked worktree.
 */
async function getGitCommonDir(repoPath: string): Promise<string | null> {
  try {
    const env = await getShellEnv()
    const proc = Bun.spawn(['git', 'rev-parse', '--git-common-dir'], {
      cwd: repoPath,
      stdout: 'pipe',
      stderr: 'pipe',
      env
    })
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    if (exitCode !== 0) return null

    const dir = stdout.trim()
    if (!dir) return null
    return path.isAbsolute(dir) ? dir : path.resolve(repoPath, dir)
  } catch {
    return null
  }
}

/** Every gh-stack file for this repo: the primary one plus one per linked worktree. */
function findStackFiles(gitCommonDir: string): string[] {
  const files: string[] = []

  const primary = path.join(gitCommonDir, STACK_FILE)
  if (fs.existsSync(primary)) files.push(primary)

  const worktreesDir = path.join(gitCommonDir, 'worktrees')
  if (fs.existsSync(worktreesDir)) {
    let entries: string[] = []
    try {
      entries = fs.readdirSync(worktreesDir)
    } catch {
      entries = []
    }
    for (const entry of entries) {
      const candidate = path.join(worktreesDir, entry, STACK_FILE)
      if (fs.existsSync(candidate)) files.push(candidate)
    }
  }

  return files
}

function normalizeBranch(raw: RawStackBranch): StackBranchInfo | null {
  if (!raw.branch || typeof raw.branch !== 'string') return null
  return {
    branch: raw.branch,
    head: typeof raw.head === 'string' ? raw.head : null,
    base: typeof raw.base === 'string' ? raw.base : null,
    prNumber: typeof raw.pullRequest?.number === 'number' ? raw.pullRequest.number : null,
    prUrl: typeof raw.pullRequest?.url === 'string' ? raw.pullRequest.url : null
  }
}

export function parseStackFile(contents: string): StackInfo[] {
  let parsed: RawStackFile
  try {
    parsed = JSON.parse(contents) as RawStackFile
  } catch {
    return []
  }

  if (!parsed || !Array.isArray(parsed.stacks)) return []

  const stacks: StackInfo[] = []
  for (const raw of parsed.stacks) {
    const trunkBranch = raw?.trunk?.branch
    if (!trunkBranch || typeof trunkBranch !== 'string') continue
    if (!Array.isArray(raw.branches)) continue

    const branches = raw.branches
      .map(normalizeBranch)
      .filter((b): b is StackBranchInfo => b !== null)
    if (branches.length === 0) continue

    stacks.push({
      id: typeof raw.id === 'string' ? raw.id : null,
      number: typeof raw.number === 'number' ? raw.number : null,
      trunkBranch,
      branches
    })
  }

  return stacks
}

/** Two records describe the same stack if they share a trunk and any branch. */
function isSameStack(a: StackInfo, b: StackInfo): boolean {
  if (a.trunkBranch !== b.trunkBranch) return false
  const names = new Set(a.branches.map((br) => br.branch))
  return b.branches.some((br) => names.has(br.branch))
}

/**
 * Fold `other` into `canonical`, filling in only fields the canonical record is
 * missing. Composition and ordering always come from the canonical (newest)
 * record so that a stale copy cannot resurrect a dropped branch.
 */
function enrich(canonical: StackInfo, other: StackInfo): StackInfo {
  const byName = new Map(other.branches.map((br) => [br.branch, br]))
  return {
    id: canonical.id ?? other.id,
    number: canonical.number ?? other.number,
    trunkBranch: canonical.trunkBranch,
    branches: canonical.branches.map((br) => {
      const match = byName.get(br.branch)
      if (!match) return br
      return {
        branch: br.branch,
        head: br.head ?? match.head,
        base: br.base ?? match.base,
        prNumber: br.prNumber ?? match.prNumber,
        prUrl: br.prUrl ?? match.prUrl
      }
    })
  }
}

/**
 * Group records describing the same stack and reduce each group to one entry.
 * The most recently written file wins on composition and ordering; the others
 * only contribute metadata it lacks.
 */
export function mergeStacks(records: TimestampedStack[]): StackInfo[] {
  const newestFirst = [...records].sort((a, b) => b.mtimeMs - a.mtimeMs)
  const groups: TimestampedStack[][] = []

  for (const record of newestFirst) {
    const group = groups.find((g) => g.some((existing) => isSameStack(existing.stack, record.stack)))
    if (group) group.push(record)
    else groups.push([record])
  }

  return groups.map((group) => {
    const [canonical, ...rest] = group
    return rest.reduce((acc, other) => enrich(acc, other.stack), canonical.stack)
  })
}

/**
 * All stacks relevant to the given branches, ordered bottom → top.
 *
 * GitHub's stacked-PR API is the source of truth: it is authoritative, needs no
 * local `gh stack` state, and so sees stacks created by anyone on any machine.
 * The local gh-stack files are only a fallback, for when the API is
 * unreachable (offline, unauthenticated) or the preview API changes shape.
 */
export async function getStacks(
  repoPath: string,
  branches: string[],
  forceRefresh = false
): Promise<StackInfo[]> {
  const cacheKey = `${repoPath}\u0000${[...branches].sort().join(',')}`
  const cached = stackCache.get(cacheKey)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.stacks
  }

  const stacks = await resolveStacks(repoPath, branches)
  stackCache.set(cacheKey, { stacks, timestamp: Date.now() })
  return stacks
}

async function resolveStacks(repoPath: string, branches: string[]): Promise<StackInfo[]> {
  const ghRepo = await getGitHubRepo(repoPath)

  if (ghRepo && branches.length > 0) {
    const remote = await getStacksForBranches(repoPath, ghRepo, branches)
    // null means the lookup failed outright; an empty array is a real answer
    // ("not stacked") and must not trigger the fallback.
    if (remote !== null) return remote
  }

  return readLocalStacks(repoPath)
}

/**
 * Fallback: reconstruct stacks from the `gh stack` state files in the git dir.
 *
 * Each worktree that ran a `gh stack` command keeps its own copy, and those
 * copies drift, so every copy is read and merged.
 */
export async function readLocalStacks(repoPath: string): Promise<StackInfo[]> {
  const gitCommonDir = await getGitCommonDir(repoPath)
  if (!gitCommonDir) return []

  const records: TimestampedStack[] = []
  for (const file of findStackFiles(gitCommonDir)) {
    try {
      const contents = fs.readFileSync(file, 'utf-8')
      const mtimeMs = fs.statSync(file).mtimeMs
      for (const stack of parseStackFile(contents)) {
        records.push({ stack, mtimeMs })
      }
    } catch {
      // A missing or unreadable copy is not fatal; other copies may still work.
    }
  }

  return mergeStacks(records)
}

/** Test seam. */
export function clearStackCache(): void {
  stackCache.clear()
}
