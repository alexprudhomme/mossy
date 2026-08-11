import { getShellEnv } from './shell-env'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Issue, JiraEpic, CreateJiraIssueParams, CreateJiraIssueResult } from '../../shared/types'

const DONE_STATUSES = new Set(['done', 'closed', 'resolved', 'completed', 'cancelled', 'canceled', 'rejected'])

export async function getMyJiraIssues(): Promise<Issue[]> {
  try {
    const env = await getShellEnv()
    const me = await getJiraMe(env)
    if (!me) return []

    const proc = Bun.spawn([
      'jira', 'issue', 'list',
      `--assignee=${me}`,
      // Exclude done issues in JQL rather than client-side: jira-cli caps
      // --paginate at 100 results, so filtering after the fact would drop
      // older open issues (including sub-tasks) out of the window.
      '-qproject IS NOT EMPTY AND statusCategory != Done',
      '--paginate', '0:100',
      '--raw'
    ], {
      stdout: 'pipe',
      stderr: 'pipe',
      env
    })

    const timer = setTimeout(() => proc.kill(), 15000)
    const [stdout, _stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text()
    ])
    const exitCode = await proc.exited
    clearTimeout(timer)

    if (exitCode !== 0) return []

    const data = JSON.parse(stdout)
    if (!Array.isArray(data)) return []

    return data
      .filter((item: any) => {
        const status: string = item.fields?.status?.name ?? ''
        const issueType: string = (item.fields?.issueType?.name || item.fields?.issuetype?.name || '').toLowerCase()
        return !DONE_STATUSES.has(status.toLowerCase()) && issueType !== 'epic'
      })
      .map((item: any) => ({
        key: item.key,
        summary: item.fields?.summary || '',
        status: item.fields?.status?.name || 'Unknown',
        assignee: item.fields?.assignee?.displayName || null,
        issueType: item.fields?.issueType?.name || item.fields?.issuetype?.name || 'Unknown',
        url: `${getJiraBaseUrl()}browse/${item.key}`
      }))
  } catch {
    return []
  }
}

async function getJiraMe(env: NodeJS.ProcessEnv): Promise<string | null> {
  try {
    const proc = Bun.spawn(['jira', 'me'], {
      stdout: 'pipe',
      stderr: 'pipe',
      env
    })
    const timer = setTimeout(() => proc.kill(), 5000)
    const [stdout, _stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text()
    ])
    const exitCode = await proc.exited
    clearTimeout(timer)
    if (exitCode !== 0) return null
    return stdout.trim() || null
  } catch {
    return null
  }
}

export async function getJiraIssue(issueKey: string): Promise<Issue | null> {
  try {
    const env = await getShellEnv()
    const proc = Bun.spawn(['jira', 'issue', 'view', issueKey, '--raw'], {
      stdout: 'pipe',
      stderr: 'pipe',
      env
    })

    const timer = setTimeout(() => proc.kill(), 15000)
    const [stdout, _stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text()
    ])
    const exitCode = await proc.exited
    clearTimeout(timer)

    if (exitCode !== 0) return null

    const data = JSON.parse(stdout)
    const fields = data.fields

    return {
      key: data.key,
      summary: fields.summary || '',
      status: fields.status?.name || 'Unknown',
      assignee: fields.assignee?.displayName || null,
      issueType: fields.issuetype?.name || 'Unknown',
      url: `${getJiraBaseUrl()}browse/${data.key}`
    }
  } catch {
    return null
  }
}

function readJiraConfig(): { server?: string; project?: string } {
  try {
    const raw = readFileSync(join(homedir(), '.config', '.jira', '.config.yml'), 'utf-8')
    const serverMatch = raw.match(/^server:\s*(.+)$/m)
    const projectMatch = raw.match(/^project:\s*(.+)$/m)
    return {
      server: serverMatch?.[1]?.trim(),
      project: projectMatch?.[1]?.trim()
    }
  } catch {
    return {}
  }
}

function getJiraBaseUrl(): string {
  const { server } = readJiraConfig()
  if (!server) return ''
  return server.endsWith('/') ? server : `${server}/`
}

export async function getJiraProject(): Promise<{ projectKey: string } | { error: string }> {
  const { project } = readJiraConfig()
  if (!project) return { error: 'Jira project not configured' }
  return { projectKey: project }
}

export async function getJiraEpics(): Promise<{ epics: JiraEpic[] } | { error: string }> {
  try {
    const env = await getShellEnv()
    const proc = Bun.spawn(['jira', 'epic', 'list', '--raw'], {
      stdout: 'pipe',
      stderr: 'pipe',
      env
    })

    const timer = setTimeout(() => proc.kill(), 15000)
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text()
    ])
    const exitCode = await proc.exited
    clearTimeout(timer)

    if (exitCode !== 0) {
      return { error: stderr.trim() || 'Failed to fetch epics' }
    }

    const data = JSON.parse(stdout)
    if (!Array.isArray(data)) {
      return { error: 'Unexpected response format from Jira CLI' }
    }

    const epics: JiraEpic[] = data
      .filter((item: any) => {
        const status: string = (item.fields?.status?.name ?? '').toLowerCase()
        return !DONE_STATUSES.has(status)
      })
      .slice(0, 50)
      .map((item: any) => ({
        key: item.key,
        summary: item.fields?.summary || ''
      }))

    return { epics }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch epics' }
  }
}

export async function getJiraCurrentUser(): Promise<{ user: string } | { error: string }> {
  try {
    const env = await getShellEnv()
    const user = await getJiraMe(env)
    if (!user) {
      return { error: 'Could not determine Jira user' }
    }
    return { user }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not determine Jira user' }
  }
}

export async function createJiraIssue(params: CreateJiraIssueParams): Promise<CreateJiraIssueResult> {
  try {
    const env = await getShellEnv()
    const me = await getJiraMe(env)

    const args = [
      'jira', 'issue', 'create',
      `-t${params.issueType}`,
      `-s${params.summary}`
    ]

    if (me) {
      args.push(`-a${me}`)
    }

    if (params.epicKey) {
      args.push(`-P${params.epicKey}`)
    }

    const proc = Bun.spawn(args, {
      stdout: 'pipe',
      stderr: 'pipe',
      env
    })

    const timer = setTimeout(() => proc.kill(), 30000)
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text()
    ])
    const exitCode = await proc.exited
    clearTimeout(timer)

    if (exitCode !== 0) {
      return { success: false, error: stderr.trim() || 'Failed to create issue' }
    }

    // Parse the created issue key from stdout (e.g., "OK PROJ-123 https://...")
    const keyMatch = stdout.match(/([A-Z][A-Z0-9]+-\d+)/)
    const issueKey = keyMatch?.[1]

    if (!issueKey) {
      return { success: false, error: 'Issue created but could not parse issue key from response' }
    }

    return { success: true, issueKey }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create issue' }
  }
}
