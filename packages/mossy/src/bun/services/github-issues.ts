import { getShellEnv } from './shell-env'
import { getConfig } from './config'
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

export async function getMyGitHubIssues(): Promise<Issue[]> {
  const config = getConfig()
  const repos = config.repositories ?? []
  if (repos.length === 0) return []

  // Resolve GitHub slugs for all configured repos
  const slugs: string[] = []
  for (const repo of repos) {
    try {
      const slug = await getGitHubRepo(repo.path)
      if (slug) slugs.push(slug)
    } catch { /* skip repos without GitHub remote */ }
  }

  if (slugs.length === 0) return []

  // Fetch issues from all repos in parallel, deduplicate by URL
  const results = await Promise.allSettled(
    slugs.map(async (slug) => {
      const stdout = await gh([
        'issue', 'list',
        '--assignee', '@me',
        '--state', 'open',
        '--json', 'number,title,state,labels,url,assignees',
        '--limit', '50',
        '-R', slug
      ])
      const data = JSON.parse(stdout)
      if (!Array.isArray(data)) return []
      return data.map((item: any) => mapGitHubIssue(item))
    })
  )

  const seen = new Set<string>()
  const issues: Issue[] = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const issue of result.value) {
      if (!seen.has(issue.url)) {
        seen.add(issue.url)
        issues.push(issue)
      }
    }
  }

  return issues
}

export async function getGitHubIssue(issueNumber: string, repoPath?: string): Promise<Issue | null> {
  try {
    const num = issueNumber.replace(/^#/, '')

    // If we have a repo path, resolve its GitHub slug for -R
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
  return {
    key: `#${item.number}`,
    summary: item.title || '',
    status: item.state === 'OPEN' ? 'Open' : item.state || 'Unknown',
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
