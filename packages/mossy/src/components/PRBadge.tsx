import { IconCircleCheck, IconCircleX, IconClock, IconGitMerge, IconGitPullRequest, IconUserCheck, IconAlertTriangle } from '@tabler/icons-react'
import { cn } from '../lib/utils'
import type { PRInfo } from '../shared/types'

interface PRBadgeProps {
  pr: PRInfo | null
  loading: boolean
}

const CI_ICON = {
  SUCCESS: <IconCircleCheck size={12} />,
  FAILURE: <IconCircleX size={12} />,
  PENDING: <IconClock size={12} />
}

const CI_COLORS: Record<string, string> = {
  SUCCESS: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  FAILURE: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  PENDING: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
}

const STATE_COLORS: Record<string, string> = {
  OPEN: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  DRAFT: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  CLOSED: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  MERGED: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  MERGE_QUEUE: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
}

const REVIEW_CONFIG: Record<string, { label: string; icon: React.ReactNode; colors: string }> = {
  APPROVED: {
    label: 'Approved',
    icon: <IconUserCheck size={12} />,
    colors: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  CHANGES_REQUESTED: {
    label: 'Changes requested',
    icon: <IconAlertTriangle size={12} />,
    colors: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  REVIEW_REQUIRED: {
    label: 'Review required',
    icon: <IconClock size={12} />,
    colors: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  },
}

export function PRBadge({ pr, loading }: PRBadgeProps) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted/50 text-muted-foreground border">
        <span className="animate-spin h-2.5 w-2.5 border border-current border-t-transparent rounded-full" />
        PR…
      </span>
    )
  }

  if (!pr) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted/50 text-[#484f58] border">
        No PR
      </span>
    )
  }

  const displayState = pr.isInMergeQueue ? 'MERGE_QUEUE' : pr.isDraft ? 'DRAFT' : pr.state
  const stateLabel = pr.isInMergeQueue ? 'merge queue' : pr.isDraft ? 'draft' : pr.state.toLowerCase()
  const StateIcon = pr.isInMergeQueue ? IconGitMerge : IconGitPullRequest

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => window.open(pr.url, '_blank')}
        title={`${pr.title}${pr.isDraft ? ' (Draft)' : ''}${pr.isInMergeQueue ? ' (Merge Queue)' : ''}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer hover:brightness-125 transition-all',
          STATE_COLORS[displayState]
        )}
      >
        <StateIcon size={12} />
        #{pr.number} {stateLabel}
      </button>

      {pr.ciStatus && (
        <button
          onClick={() => window.open(`${pr.url}/checks`, '_blank')}
          title={`CI: ${pr.ciStatus === 'FAILURE' ? `${pr.ciFailed} failed of ${pr.ciTotal}` : pr.ciStatus.toLowerCase()}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-pointer hover:brightness-125 transition-all',
            CI_COLORS[pr.ciStatus]
          )}
        >
          {CI_ICON[pr.ciStatus]}
          {pr.ciStatus === 'FAILURE' ? `${pr.ciFailed}/${pr.ciTotal}` : 'CI'}
        </button>
      )}

      {pr.reviewDecision && REVIEW_CONFIG[pr.reviewDecision] && (
        <span
          title={REVIEW_CONFIG[pr.reviewDecision].label}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-default',
            REVIEW_CONFIG[pr.reviewDecision].colors
          )}
        >
          {REVIEW_CONFIG[pr.reviewDecision].icon}
          {pr.reviewDecision === 'APPROVED' ? 'Approved' : pr.reviewDecision === 'CHANGES_REQUESTED' ? 'Changes' : 'Review'}
        </span>
      )}
    </div>
  )
}
