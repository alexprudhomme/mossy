import { useDraggable } from '@dnd-kit/core'
import { cn } from '../lib/utils'
import type { Issue } from '../shared/types'
import { makeIssueDragId } from '../hooks/useIssueDrag'
import type { IssueDragData } from '../hooks/useIssueDrag'

const STATUS_COLORS: Record<string, string> = {
  'To Do': 'bg-muted/60 text-muted-foreground',
  'Open': 'bg-muted/60 text-muted-foreground',
  'open': 'bg-emerald-500/20 text-emerald-400',
  'New': 'bg-muted/60 text-muted-foreground',
  'Upcoming': 'bg-muted/60 text-muted-foreground',
  'In Progress': 'bg-cyan-500/20 text-cyan-400',
  'In Review': 'bg-violet-500/20 text-violet-400',
  'Accepted': 'bg-emerald-500/20 text-emerald-400',
  'Ready for implementation': 'bg-amber-500/20 text-amber-400',
  'On Hold': 'bg-orange-500/20 text-orange-400',
  'Done': 'bg-emerald-500/20 text-emerald-400',
  'Closed': 'bg-emerald-500/20 text-emerald-400',
  'closed': 'bg-violet-500/20 text-violet-400',
  'Resolved': 'bg-emerald-500/20 text-emerald-400',
  'Merged': '',
}

const TYPE_COLORS: Record<string, string> = {
  'Bug': 'bg-pink-500/20 text-pink-400',
  'User Story': 'bg-primary/20 text-primary',
  'Story': 'bg-primary/20 text-primary',
  'Task': 'bg-cyan-500/20 text-cyan-400',
  'Sub-task': 'bg-muted/60 text-muted-foreground',
  'Epic': 'bg-violet-500/20 text-violet-400'
}

interface IssueCardProps {
  issue: Issue
  isDragging?: boolean
}

export function IssueCard({ issue, isDragging: isDraggingProp }: IssueCardProps) {
  const dragData: IssueDragData = {
    issueKey: issue.key,
    issueSummary: issue.summary
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: makeIssueDragId(issue.key),
    data: dragData,
  })

  const statusColor = STATUS_COLORS[issue.status] ?? 'bg-muted/60 text-muted-foreground'
  const typeColor = TYPE_COLORS[issue.issueType] ?? 'bg-muted/60 text-muted-foreground'

  const dragging = isDragging || isDraggingProp

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border bg-card p-3 select-none transition-opacity',
        dragging ? 'opacity-40' : 'opacity-100',
        'cursor-grab active:cursor-grabbing'
      )}
      onDoubleClick={() => { if (issue.url) window.open(issue.url, '_blank') }}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor}`}>
          {issue.issueType}
        </span>
        <span className="text-[10px] font-mono text-[#484f58] shrink-0">
          {issue.key}
        </span>
        {issue.status === 'Merged' ? (
          <span className="rainbow-approved-pill relative ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium border shrink-0 cursor-default">
            <span className="sparkle" aria-hidden>✦</span>
            <span className="sparkle" aria-hidden>✦</span>
            <span className="sparkle" aria-hidden>✦</span>
            <span className="rainbow-text">Merged</span>
          </span>
        ) : (
          <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${statusColor}`}>
            {issue.status}
          </span>
        )}
      </div>
      <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
        {issue.summary}
      </p>
    </div>
  )
}

/** Presentational-only version of the card used in DragOverlay */
export function IssueCardOverlay({ issue }: { issue: Issue }) {
  const statusColor = STATUS_COLORS[issue.status] ?? 'bg-muted/60 text-muted-foreground'
  const typeColor = TYPE_COLORS[issue.issueType] ?? 'bg-muted/60 text-muted-foreground'

  return (
    <div className="rounded-lg border border-primary/50 bg-card p-3 select-none shadow-lg shadow-black/40 w-[240px]">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor}`}>
          {issue.issueType}
        </span>
        <span className="text-[10px] font-mono text-[#484f58] shrink-0">
          {issue.key}
        </span>
        {issue.status === 'Merged' ? (
          <span className="rainbow-approved-pill relative ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium border shrink-0 cursor-default">
            <span className="sparkle" aria-hidden>✦</span>
            <span className="sparkle" aria-hidden>✦</span>
            <span className="sparkle" aria-hidden>✦</span>
            <span className="rainbow-text">Merged</span>
          </span>
        ) : (
          <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${statusColor}`}>
            {issue.status}
          </span>
        )}
      </div>
      <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
        {issue.summary}
      </p>
    </div>
  )
}
