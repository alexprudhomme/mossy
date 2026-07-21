import { useState, useRef, useEffect, useCallback } from 'react'
import { IconRefresh, IconPlus } from '@tabler/icons-react'
import { IssueCard } from './IssueCard'
import { CreateJiraTicketForm } from './CreateJiraTicketForm'
import { ScrollArea } from './ui/scroll-area'
import type { Issue, IssueTracker } from '../shared/types'

interface IssuePanelProps {
  issues: Issue[]
  loading: boolean
  onRefresh: () => void
  onResize: (width: number) => void
  issueTracker: IssueTracker
}

const STATUS_ORDER: Record<string, number> = {
  'In Progress': 0,
  'In Review': 1,
  'Accepted': 2,
  'Ready for implementation': 3,
  'To Do': 4,
  'New': 5,
  'Open': 6,
  'open': 6,
  'Upcoming': 7,
  'On Hold': 8,
  'Done': 9,
  'Closed': 9,
  'closed': 9,
  'Resolved': 9,
  'Merged': 10,
}

function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 6
    const orderB = STATUS_ORDER[b.status] ?? 6
    return orderA - orderB
  })
}

export function IssuePanel({ issues, loading, onRefresh, onResize, issueTracker }: IssuePanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

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

  const handleCreated = useCallback(() => {
    setShowCreateForm(false)
    // Give Jira a moment to index the new issue before refreshing
    timerRef.current = setTimeout(() => onRefresh(), 2000)
  }, [onRefresh])

  return (
    <>
      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 hover:bg-primary/30"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span className="text-[10px] font-semibold text-[#484f58] uppercase tracking-wider">
          My {trackerLabel} Issues
        </span>
        <div className="flex items-center gap-0.5">
          {issueTracker === 'jira' && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
              aria-label="Create Jira ticket"
            >
              <IconPlus size={14} />
            </button>
          )}
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
      </div>

      {/* Scroll wrapper: flex-1 + relative creates a sized box; absolute child fills it */}
      <div className="flex-1 relative min-h-0">
        {loading && issues.length === 0 ? (
          <div className="flex justify-center pt-8">
            <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : issues.length === 0 ? (
          <p className="text-xs text-[#484f58] text-center pt-8">
            No open issues assigned to you
          </p>
        ) : (
          <div className="absolute inset-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-1.5 px-3 pb-3">
                {sortIssues(issues).map((issue) => (
                  <IssueCard key={issue.key} issue={issue} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="create-jira-ticket-title">
          <div className="bg-card rounded-lg border shadow-lg max-w-md w-full mx-4 overflow-visible">
            <CreateJiraTicketForm
              onClose={() => setShowCreateForm(false)}
              onCreated={handleCreated}
            />
          </div>
        </div>
      )}
    </>
  )
}
