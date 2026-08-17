import path from 'node:path'
import fs from 'node:fs'
import { getShellEnv } from './shell-env'
import type { StackBranchInfo, StackInfo } from '../../shared/types'

/**
 * Reads `gh stack` state directly from the git directory rather than shelling
 * out to `gh stack view --json`, which only works when the *current* branch is
 * part of a stack and so cannot enumerate a repository's stacks.
 *
 * Each worktree that has run a `gh stack` command keeps its own copy of the
 * state at `<git-dir>/gh-stack`, and those copies drift: a copy written before
 * `gh stack submit` has no stack id/number and no per-branch `head`. We
 * therefore read every copy and merge them.
 */

const STACK_FILE = 'gh-stack'
const CACHE_TTL_MS = 30_000

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
 * All `gh stack` stacks known locally for a repo, ordered bottom → top within
 * each stack. Returns an empty array when the repo has no stacks or `gh stack`
 * has never run there.
 */
export async function getStacks(repoPath: string, forceRefresh = false): Promise<StackInfo[]> {
  const cached = stackCache.get(repoPath)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.stacks
  }

  const gitCommonDir = await getGitCommonDir(repoPath)
  if (!gitCommonDir) {
    stackCache.set(repoPath, { stacks: [], timestamp: Date.now() })
    return []
  }

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

  const stacks = mergeStacks(records)
  stackCache.set(repoPath, { stacks, timestamp: Date.now() })
  return stacks
}

/** Test seam. */
export function clearStackCache(): void {
  stackCache.clear()
}
