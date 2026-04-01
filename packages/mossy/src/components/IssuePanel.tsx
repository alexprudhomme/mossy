import { IconRefresh } from '@tabler/icons-react'
import { IssueCard } from './IssueCard'
import type { Issue, IssueTracker } from '../shared/types'
import type { IssueDragData } from '../hooks/useIssueDrag'

interface IssuePanelProps {
  issues: Issue[]
  loading: boolean
  onRefresh: () => void
  draggingKey: string | null
  onIssueMouseDown: (e: React.MouseEvent, data: IssueDragData) => void
  onResize: (width: number) => void
  issueTracker: IssueTracker
}

export function IssuePanel({ issues, loading, onRefresh, draggingKey, onIssueMouseDown, onResize, issueTracker }: IssuePanelProps) {
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = (e.currentTarget as HTMLElement).parentElement!.offsetWidth

    const onMove = (me: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(600, startWidth - (me.clientX - startX)))
      onResize(newWidth)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const trackerLabel = issueTracker === 'jira' ? 'Jira' : issueTracker === 'github' ? 'GitHub' : 'Issues'

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 hover:bg-primary/30"
      />

      <div className="flex items-center justify-between px-3 pt-3 shrink-0">
        <span className="text-[10px] font-semibold text-[#484f58] uppercase tracking-wider">
          My {trackerLabel} Issues
        </span>
        <button
          onClick={onRefresh}
          className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
          disabled={loading}
        >
          {loading ? (
            <span className="animate-spin h-3.5 w-3.5 border border-muted-foreground border-t-transparent rounded-full inline-block" />
          ) : (
            <IconRefresh size={14} />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {loading && issues.length === 0 ? (
          <div className="flex justify-center pt-8">
            <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : issues.length === 0 ? (
          <p className="text-xs text-[#484f58] text-center pt-8">
            No open issues assigned to you
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 mt-2">
            {issues.map((issue) => (
              <IssueCard
                key={issue.key}
                issue={issue}
                isDragging={draggingKey === issue.key}
                onMouseDown={onIssueMouseDown}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
