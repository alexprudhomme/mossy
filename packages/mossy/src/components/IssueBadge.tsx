import type { Issue, IssueTracker } from '../shared/types'

const TRACKER_COLORS: Record<IssueTracker, string> = {
  jira: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  github: 'bg-muted/50 text-muted-foreground border-border',
  none: '',
}

interface IssueBadgeProps {
  issueKey: string | null
  issue: Issue | null
  loading: boolean
  issueTracker: IssueTracker
}

export function IssueBadge({ issueKey, issue, loading, issueTracker }: IssueBadgeProps) {
  if (issueTracker === 'none' || !issueKey) return null

  const color = TRACKER_COLORS[issueTracker]

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${color}`}>
        <span className="animate-spin h-2.5 w-2.5 border border-current border-t-transparent rounded-full" />
        {issueKey}
      </span>
    )
  }

  if (!issue) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-pink-500/15 text-pink-400 border border-pink-500/30">
        {issueKey} (not found)
      </span>
    )
  }

  return (
    <button
      onClick={() => { if (issue.url) window.open(issue.url, '_blank') }}
      title={`${issue.summary} — ${issue.status}`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer hover:brightness-125 transition-all ${color}`}
    >
      {issue.key}
    </button>
  )
}
