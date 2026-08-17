import { getShellEnv } from './shell-env'
import type { PRInfo, RateLimitStatus, StackInfo } from '../../shared/types'

let rateLimitStatus: RateLimitStatus = { limited: false, resetsAt: null }

async function gh(args: string[], cwd: string, timeout = 15000): Promise<string> {
  const env = await getShellEnv()
  const proc = Bun.spawn(['gh', ...args], { cwd, stdout: 'pipe', stderr: 'pipe', env })

  const timer = setTimeout(() => proc.kill(), timeout)
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  clearTimeout(timer)

  // Detect rate limit from stderr
  const combinedOutput = `${stdout}\n${stderr}`
  if (combinedOutput.toLowerCase().includes('rate limit')) {
    rateLimitStatus = { limited: true, resetsAt: null }
    // Try to extract reset time by checking rate_limit API
    void updateRateLimitResetTime(cwd, env)
    throw new Error('GitHub API rate limit exceeded')
  }

  if (exitCode !== 0) {
    throw new Error(`gh exited with code ${exitCode}`)
  }

  // If we got here, rate limit is not an issue
  if (rateLimitStatus.limited) {
    rateLimitStatus = { limited: false, resetsAt: null }
  }

  return stdout
}

async function updateRateLimitResetTime(cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  try {
    const proc = Bun.spawn(
      ['gh', 'api', 'rate_limit', '--jq', '.resources.graphql.reset'],
      { cwd, stdout: 'pipe', stderr: 'pipe', env }
    )
    const timer = setTimeout(() => proc.kill(), 5000)
    const stdout = await new Response(proc.stdout).text()
    const exitCode = await proc.exited
    clearTimeout(timer)

    if (exitCode === 0 && stdout.trim()) {
      const resetTimestamp = parseInt(stdout.trim(), 10)
      if (!isNaN(resetTimestamp)) {
        rateLimitStatus = {
          limited: true,
          resetsAt: new Date(resetTimestamp * 1000).toISOString()
        }
      }
    }
  } catch {
    // Ignore errors when fetching reset time
  }
}

export function getRateLimitStatus(): RateLimitStatus {
  // Check if rate limit has reset
  if (rateLimitStatus.limited && rateLimitStatus.resetsAt) {
    const resetTime = new Date(rateLimitStatus.resetsAt).getTime()
    if (Date.now() > resetTime) {
      rateLimitStatus = { limited: false, resetsAt: null }
    }
  }
  return rateLimitStatus
}

async function getMergeQueueStatus(
  repoPath: string,
  ghRepo: string,
  prNumber: number
): Promise<boolean> {
  try {
    const [owner, name] = ghRepo.split('/')
    const query = `query($owner:String!,$name:String!,$pr:Int!){repository(owner:$owner,name:$name){pullRequest(number:$pr){mergeQueueEntry{id}}}}`
    const stdout = await gh(
      ['api', 'graphql', '-f', `query=${query}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `pr=${prNumber}`],
      repoPath
    )
    const result = JSON.parse(stdout)
    return result?.data?.repository?.pullRequest?.mergeQueueEntry != null
  } catch {
    return false
  }
}

export async function getPRForBranch(
  repoPath: string,
  branch: string,
  ghRepo: string
): Promise<PRInfo | null> {
  try {
    const stdout = await gh(
      [
        'pr', 'view', branch,
        '--json', 'number,url,title,body,state,isDraft,reviewDecision,statusCheckRollup,latestReviews',
        '-R', ghRepo
      ],
      repoPath
    )

    const data = JSON.parse(stdout)
    const [ci, isInMergeQueue] = await Promise.all([
      Promise.resolve(mapCIStatus(data.statusCheckRollup)),
      getMergeQueueStatus(repoPath, ghRepo, data.number)
    ])
    return {
      number: data.number,
      url: data.url,
      title: data.title,
      body: data.body ?? null,
      state: data.state as PRInfo['state'],
      isDraft: data.isDraft ?? false,
      isInMergeQueue,
      reviewDecision: mapReviewDecision(data.reviewDecision, data.latestReviews),
      ...ci
    }
  } catch {
    return null
  }
}

const VALID_REVIEW_DECISIONS = new Set(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED'])

// --- Stacked pull requests (gh stack) ---

/**
 * How many branches to look up per GraphQL request. The point cost is 1
 * regardless, so this only bounds the size of the query document.
 */
const STACK_BRANCH_CHUNK = 25

/** Max layers read per stack. Stacks are small in practice. */
const STACK_ENTRY_LIMIT = 50

interface RawStackEntryNode {
  position?: number
  pullRequest?: { number?: number; url?: string; headRefName?: string }
}

interface RawRemoteStack {
  id?: string
  number?: number
  size?: number
  baseRefName?: string
  entries?: { nodes?: RawStackEntryNode[] }
}

/**
 * Turn one GraphQL response into stacks, deduplicated by stack identity.
 * Exported for tests.
 */
export function parseStackQueryResponse(json: string): StackInfo[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return []
  }

  const repository = (parsed as { data?: { repository?: Record<string, unknown> } })?.data?.repository
  if (!repository) return []

  const byIdentity = new Map<string, StackInfo>()

  for (const value of Object.values(repository)) {
    const nodes = (value as { nodes?: Array<{ stack?: RawRemoteStack | null }> })?.nodes
    if (!Array.isArray(nodes)) continue

    for (const node of nodes) {
      const raw = node?.stack
      if (!raw) continue // null means this PR is not in a stack

      const trunkBranch = raw.baseRefName
      if (!trunkBranch) continue

      const entries = raw.entries?.nodes
      if (!Array.isArray(entries) || entries.length === 0) continue

      // GraphQL does not guarantee ordering; `position` is authoritative.
      const branches = entries
        .filter((entry) => typeof entry?.position === 'number' && entry.pullRequest?.headRefName)
        .sort((a, b) => (a.position as number) - (b.position as number))
        .map((entry) => ({
          branch: entry.pullRequest?.headRefName as string,
          // The API models stacks by PR, not by commit, so there is no
          // head/base to report. Only the local files carry those.
          head: null,
          base: null,
          prNumber: typeof entry.pullRequest?.number === 'number' ? entry.pullRequest.number : null,
          prUrl: typeof entry.pullRequest?.url === 'string' ? entry.pullRequest.url : null
        }))

      if (branches.length === 0) continue

      const identity = raw.id ?? (raw.number !== undefined ? `#${raw.number}` : branches.map((b) => b.branch).join('>'))
      if (byIdentity.has(identity)) continue

      byIdentity.set(identity, {
        id: typeof raw.id === 'string' ? raw.id : null,
        number: typeof raw.number === 'number' ? raw.number : null,
        trunkBranch,
        branches
      })
    }
  }

  return [...byIdentity.values()]
}

function buildStackQuery(branchCount: number): string {
  const vars = Array.from({ length: branchCount }, (_, i) => `$b${i}:String!`).join(',')
  const selections = Array.from({ length: branchCount }, (_, i) =>
    `s${i}:pullRequests(headRefName:$b${i},first:1,states:OPEN){nodes{stack{id number size baseRefName entries(first:${STACK_ENTRY_LIMIT}){nodes{position pullRequest{number url headRefName}}}}}}`
  ).join(' ')
  return `query($owner:String!,$name:String!,${vars}){repository(owner:$owner,name:$name){${selections}}}`
}

/**
 * Look up the stack each branch belongs to, using GitHub's stacked-PR API.
 *
 * This is authoritative and needs no local `gh stack` state, so it sees stacks
 * created by anyone on any machine. Returns null when the lookup could not be
 * performed at all (offline, unauthenticated, or the preview API changed), so
 * the caller can fall back to reading local state. An empty array means the
 * lookup succeeded and these branches are genuinely not stacked.
 */
export async function getStacksForBranches(
  repoPath: string,
  ghRepo: string,
  branches: string[]
): Promise<StackInfo[] | null> {
  const unique = [...new Set(branches.filter((b) => b && b !== '(detached)'))]
  if (unique.length === 0) return []

  const [owner, name] = ghRepo.split('/')
  if (!owner || !name) return null

  const stacks: StackInfo[] = []
  let anyChunkSucceeded = false

  for (let i = 0; i < unique.length; i += STACK_BRANCH_CHUNK) {
    const chunk = unique.slice(i, i + STACK_BRANCH_CHUNK)
    const args = [
      'api', 'graphql',
      '-f', `query=${buildStackQuery(chunk.length)}`,
      // -f keeps values as literal strings; -F would coerce a branch
      // named "123" or "true" into a number or boolean.
      '-f', `owner=${owner}`,
      '-f', `name=${name}`,
      ...chunk.flatMap((branch, idx) => ['-f', `b${idx}=${branch}`])
    ]

    try {
      const stdout = await gh(args, repoPath)
      anyChunkSucceeded = true
      stacks.push(...parseStackQueryResponse(stdout))
    } catch {
      // Leave anyChunkSucceeded alone; a total failure returns null below.
    }
  }

  if (!anyChunkSucceeded) return null

  // Deduplicate across chunks
  const seen = new Map<string, StackInfo>()
  for (const stack of stacks) {
    const key = stack.id ?? (stack.number !== null ? `#${stack.number}` : stack.branches.map((b) => b.branch).join('>'))
    if (!seen.has(key)) seen.set(key, stack)
  }
  return [...seen.values()]
}

function mapReviewDecision(
  reviewDecision: string | null | undefined,
  latestReviews: Array<{ state: string }> | null | undefined
): PRInfo['reviewDecision'] {
  // Prefer the branch-protection review decision when available
  if (reviewDecision && VALID_REVIEW_DECISIONS.has(reviewDecision)) {
    return reviewDecision as PRInfo['reviewDecision']
  }

  // Fall back to computing from individual reviews (covers repos without required reviews)
  if (!latestReviews || latestReviews.length === 0) return null

  if (latestReviews.some((r) => r.state === 'CHANGES_REQUESTED')) return 'CHANGES_REQUESTED'
  if (latestReviews.some((r) => r.state === 'APPROVED')) return 'APPROVED'

  return null
}

interface CIResult {
  ciStatus: PRInfo['ciStatus']
  ciFailed: number
  ciTotal: number
}

function mapCIStatus(
  checks: Array<{ status: string; conclusion: string; state: string }> | null | undefined
): CIResult {
  if (!checks || checks.length === 0) return { ciStatus: null, ciFailed: 0, ciTotal: 0 }

  const total = checks.length
  const failed = checks.filter(
    (c) => c.conclusion === 'FAILURE' || c.conclusion === 'ERROR' || c.state === 'FAILURE'
  ).length

  if (failed > 0) return { ciStatus: 'FAILURE', ciFailed: failed, ciTotal: total }

  const allDone = checks.every(
    (c) => c.status === 'COMPLETED' || c.state === 'SUCCESS' || c.state === 'NEUTRAL'
  )
  if (allDone) return { ciStatus: 'SUCCESS', ciFailed: 0, ciTotal: total }

  return { ciStatus: 'PENDING', ciFailed: 0, ciTotal: total }
}
