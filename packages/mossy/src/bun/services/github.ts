import { getShellEnv } from './shell-env'
import type { PRInfo, RateLimitStatus } from '../../shared/types'

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
