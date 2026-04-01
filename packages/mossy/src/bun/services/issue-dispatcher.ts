import { getConfig } from './config'
import { getJiraIssue, getMyJiraIssues } from './jira'
import { getGitHubIssue, getMyGitHubIssues } from './github-issues'
import type { Issue } from '../../shared/types'

export async function getCurrentIssue(issueKey: string): Promise<Issue | null> {
  const config = getConfig()
  switch (config.issueTracker) {
    case 'jira':
      return getJiraIssue(issueKey)
    case 'github':
      return getGitHubIssue(issueKey)
    case 'none':
      return null
  }
}

export async function getMyIssues(): Promise<Issue[]> {
  const config = getConfig()
  switch (config.issueTracker) {
    case 'jira':
      return getMyJiraIssues()
    case 'github':
      return getMyGitHubIssues()
    case 'none':
      return []
  }
}
