import { getShellEnv } from './shell-env'
import { getGitHubRepo } from './git'
import type { Issue } from '../../shared/types'

async function gh(args: string[], cwd?: string, timeout = 15000): Promise<string> {
  const env = await getShellEnv()
  const opts: Record<string, unknown> = { stdout: 'pipe', stderr: 'pipe', env }
  if (cwd) opts.cwd = cwd
  const proc = Bun.spawn(['gh', ...args], opts)

  const timer = setTimeout(() => proc.kill(), timeout)
  const stdout = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  clearTimeout(timer)

  if (exitCode !== 0) {
    throw new Error(`gh exited with code ${exitCode}`)
  }
  return stdout
}

/** Fetch all open issues assigned to the current user across ALL GitHub repos. */
export async function getMyGitHubIssues(): Promise<Issue[]> {
  try {
    const stdout = await gh([
      'search', 'issues',
      '--assignee=@me',
      '--state=open',
      '--json', 'number,title,state,labels,url,assignees,repository',
      '--limit', '100'
    ])

    const data = JSON.parse(stdout)
    if (!Array.isArray(data)) return []

    return data.map((item: any) => mapGitHubIssue(item))
  } catch {
    return []
  }
}

export async function getGitHubIssue(issueNumber: string, repoPath?: string): Promise<Issue | null> {
  try {
    const num = issueNumber.replace(/^#/, '')

    // Resolve GitHub slug for -R flag
    let repoFlag: string[] = []
    if (repoPath) {
      const slug = await getGitHubRepo(repoPath)
      if (slug) repoFlag = ['-R', slug]
    }

    const stdout = await gh([
      'issue', 'view', num,
      '--json', 'number,title,state,labels,url,assignees',
      ...repoFlag
    ], repoPath)

    const data = JSON.parse(stdout)
    return mapGitHubIssue(data)
  } catch {
    return null
  }
}

function mapGitHubIssue(item: any): Issue {
  const repo = item.repository?.nameWithOwner
  const key = repo ? `${repo}#${item.number}` : `#${item.number}`
  return {
    key,
    summary: item.title || '',
    status: item.state === 'OPEN' || item.state === 'open' ? 'Open' : item.state || 'Unknown',
    assignee: item.assignees?.[0]?.login || null,
    issueType: mapLabelsToType(item.labels),
    url: item.url || ''
  }
}

function mapLabelsToType(labels: Array<{ name: string }> | null | undefined): string {
  if (!labels || labels.length === 0) return 'Issue'
  const names = labels.map((l) => l.name.toLowerCase())
  if (names.some((n) => n === 'bug' || n.includes('bug'))) return 'Bug'
  if (names.some((n) => n === 'enhancement' || n === 'feature' || n.includes('feature'))) return 'Feature'
  if (names.some((n) => n === 'task')) return 'Task'
  return 'Issue'
}
