import { getShellEnv } from './shell-env'
import type { Issue } from '../../shared/types'

async function gh(args: string[], timeout = 15000): Promise<string> {
  const env = await getShellEnv()
  const proc = Bun.spawn(['gh', ...args], { stdout: 'pipe', stderr: 'pipe', env })

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
  try {
    const stdout = await gh([
      'issue', 'list',
      '--assignee', '@me',
      '--state', 'open',
      '--json', 'number,title,state,labels,url,assignees',
      '--limit', '100'
    ])

    const data = JSON.parse(stdout)
    if (!Array.isArray(data)) return []

    return data.map((item: any) => ({
      key: `#${item.number}`,
      summary: item.title || '',
      status: item.state === 'OPEN' ? 'Open' : item.state || 'Unknown',
      assignee: item.assignees?.[0]?.login || null,
      issueType: mapLabelsToType(item.labels),
      url: item.url || ''
    }))
  } catch {
    return []
  }
}

export async function getGitHubIssue(issueNumber: string): Promise<Issue | null> {
  try {
    const num = issueNumber.replace(/^#/, '')
    const stdout = await gh([
      'issue', 'view', num,
      '--json', 'number,title,state,labels,url,assignees'
    ])

    const data = JSON.parse(stdout)
    return {
      key: `#${data.number}`,
      summary: data.title || '',
      status: data.state === 'OPEN' ? 'Open' : data.state || 'Unknown',
      assignee: data.assignees?.[0]?.login || null,
      issueType: mapLabelsToType(data.labels),
      url: data.url || ''
    }
  } catch {
    return null
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
