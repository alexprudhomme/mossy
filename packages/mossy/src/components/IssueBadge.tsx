import type { Issue, IssueTracker } from '../shared/types'

const STATUS_COLORS: Record<string, string> = {
  'To Do': 'bg-muted/50 text-muted-foreground',
  'Open': 'bg-muted/50 text-muted-foreground',
  'New': 'bg-muted/50 text-muted-foreground',
  'open': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'In Progress': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'In Review': 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  'Done': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Closed': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'closed': 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  'Resolved': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
}

interface IssueBadgeProps {
  issueKey: string | null
  issue: Issue | null
  loading: boolean
  issueTracker: IssueTracker
}

export function IssueBadge({ issueKey, issue, loading, issueTracker }: IssueBadgeProps) {
  if (issueTracker === 'none' || !issueKey) return null

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted/50 text-muted-foreground border">
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

  const color = STATUS_COLORS[issue.status] ?? 'bg-muted/50 text-muted-foreground'

  return (
    <button
      onClick={() => { if (issue.url) window.open(issue.url, '_blank') }}
      title={`${issue.summary} — ${issue.status}`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer hover:brightness-125 transition-all ${color}`}
    >
      {issue.key} · {issue.status}
    </button>
  )
}
