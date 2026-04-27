import { useState, useCallback, useMemo } from 'react'
import { IconGitBranch, IconTrash, IconChevronDown, IconChevronRight, IconGripVertical, IconClockPause } from '@tabler/icons-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../lib/utils'
import { IssueBadge } from './IssueBadge'
import { PRBadge } from './PRBadge'
import { ReviewBadge } from './ReviewBadge'
import { ConflictsBadge } from './ConflictsBadge'
import { DirtyBadge } from './DirtyBadge'
import { LaunchButtons } from './LaunchButtons'
import { DeleteWorktreeModal } from './DeleteWorktreeModal'
import { DiffPanel } from './DiffPanel'
import { useIssue } from '../hooks/useIssue'
import { usePR } from '../hooks/usePR'
import { useWorktreeStatus } from '../hooks/useWorktreeStatus'
import { useMergeConflicts } from '../hooks/useMergeConflicts'
import { useHomedir } from '../hooks/useHomedir'
import { rpc } from '../rpc'
import type { IdeId, IssueTracker, TerminalId, Worktree } from '../shared/types'

interface WorktreeCardProps {
  worktree: Worktree
  repoPath: string
  pollIntervalSec: number
  refreshKey: number
  defaultIde: IdeId
  defaultTerminal: TerminalId
  issueTracker: IssueTracker
  deleting?: boolean
  settingUp?: boolean
  notReady?: boolean
  onToggleNotReady?: () => void
  onConfirmDelete: (force: boolean) => void
}

const JIRA_KEY_REGEX = /([a-zA-Z][a-zA-Z0-9]+-\d+)/i
const GH_ISSUE_REGEX = /(?:^|[/-])(\d+)(?:[/-]|$)/
const GH_ISSUE_BODY_REGEX = /#(\d+)/

function extractIssueKeyFromBranch(branch: string, tracker: IssueTracker): string | null {
  if (tracker === 'jira') {
    const match = branch.match(JIRA_KEY_REGEX)
    return match ? match[1].toUpperCase() : null
  }
  if (tracker === 'github') {
    const match = branch.match(GH_ISSUE_REGEX)
    return match ? match[1] : null
  }
  return null
}

function extractIssueKeyFromPRBody(body: string | null | undefined, tracker: IssueTracker): string | null {
  if (!body) return null
  if (tracker === 'jira') {
    const match = body.match(JIRA_KEY_REGEX)
    return match ? match[1].toUpperCase() : null
  }
  if (tracker === 'github') {
    const match = body.match(GH_ISSUE_BODY_REGEX)
    return match ? match[1] : null
  }
  return null
}

export function WorktreeCard({
  worktree, repoPath, pollIntervalSec, refreshKey, defaultIde, defaultTerminal, issueTracker,
  deleting, settingUp, notReady, onToggleNotReady, onConfirmDelete
}: WorktreeCardProps) {
  const [deleteOpened, setDeleteOpened] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: worktree.path })

  const { pr, loading: prLoading } = usePR(repoPath, worktree.isMain ? null : worktree.branch, pollIntervalSec, refreshKey)

  // Prefer issue key from PR description; fall back to branch name when no PR exists
  const issueKey = useMemo(() => {
    if (worktree.isMain) return extractIssueKeyFromBranch(worktree.branch, issueTracker)
    if (prLoading) return null
    if (pr) return extractIssueKeyFromPRBody(pr.body, issueTracker)
    return extractIssueKeyFromBranch(worktree.branch, issueTracker)
  }, [pr, prLoading, worktree.branch, worktree.isMain, issueTracker])

  const { issue, loading: issueLoading } = useIssue(issueKey, pollIntervalSec, refreshKey, repoPath)
  const { status: wtStatus, loading: wtStatusLoading, refresh: refreshStatus } = useWorktreeStatus(worktree.path, pollIntervalSec, refreshKey)
  const { conflicts, loading: conflictsLoading } = useMergeConflicts(worktree.path, repoPath, worktree.isMain, pollIntervalSec, refreshKey)
  const { shortenPath } = useHomedir()

  const toggleExpand = useCallback(() => {
    if (!deleting) setExpanded((prev) => !prev)
  }, [deleting])

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-lg border overflow-hidden transition-all duration-150',
        isDragging
          ? 'opacity-40'
          : deleting
            ? 'border-border/50 bg-card/50 opacity-45 pointer-events-none'
            : notReady
              ? hovered
                ? 'border-yellow-500/30 bg-gradient-to-br from-yellow-500/[0.06] to-yellow-500/[0.02] opacity-60'
                : 'border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.03] to-transparent opacity-55'
              : hovered
                ? 'border-primary/45 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02]'
                : 'border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent',
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? transition ?? undefined : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              className="p-0.5 rounded-md text-[#484f58] hover:text-muted-foreground cursor-grab touch-none transition-colors shrink-0"
              {...attributes}
              {...listeners}
            >
              <IconGripVertical size={14} />
            </button>
            <button
              onClick={toggleExpand}
              className="p-0.5 rounded-md hover:bg-accent text-muted-foreground transition-colors shrink-0"
              title={expanded ? 'Collapse diff panel' : 'Expand diff panel'}
            >
              {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </button>
            <IconGitBranch size={18} className={deleting ? 'text-[#484f58]' : 'text-primary'} style={{ flexShrink: 0 }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold font-mono text-foreground truncate">
                  {worktree.branch}
                </span>
                {worktree.isMain && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/30 shrink-0">
                    main
                  </span>
                )}
                {notReady && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 shrink-0">
                    not ready
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate block">
                {shortenPath(worktree.path)}
              </span>
            </div>
          </div>

          {deleting ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="animate-spin h-3.5 w-3.5 border border-[#484f58] border-t-transparent rounded-full" />
              <span className="text-xs text-[#484f58]">Deleting…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 shrink-0">
                {settingUp && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/30">
                    <span className="animate-spin h-2 w-2 border border-primary border-t-transparent rounded-full" />
                    Setting up…
                  </span>
                )}
                <DirtyBadge status={wtStatus} loading={wtStatusLoading} worktreePath={worktree.path} onPullComplete={refreshStatus} />
                <ReviewBadge pr={pr} />
                <PRBadge pr={pr} loading={prLoading} />
                <ConflictsBadge conflicts={conflicts} loading={conflictsLoading} />
                <IssueBadge issueKey={issueKey} issue={issue} loading={issueLoading} issueTracker={issueTracker} />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <LaunchButtons worktreePath={worktree.path} defaultIde={defaultIde} defaultTerminal={defaultTerminal} />
                {!worktree.isMain && (
                  <button
                    title={notReady ? 'Mark as ready' : 'Mark as not ready'}
                    onClick={onToggleNotReady}
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      notReady
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'text-muted-foreground hover:bg-yellow-500/20 hover:text-yellow-400'
                    )}
                  >
                    <IconClockPause size={16} />
                  </button>
                )}
                {!worktree.isMain && (
                  <button
                    title="Delete worktree"
                    onClick={() => setDeleteOpened(true)}
                    className="p-1 rounded-md hover:bg-pink-500/20 text-muted-foreground hover:text-pink-400 transition-colors"
                  >
                    <IconTrash size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expandable diff panel — seamless continuation of the card */}
      {expanded && !deleting && (
        <div className="border-t border-border/50">
          <DiffPanel worktreePath={worktree.path} />
        </div>
      )}

      <DeleteWorktreeModal
        worktree={worktree}
        opened={deleteOpened}
        onClose={() => setDeleteOpened(false)}
        onConfirm={onConfirmDelete}
      />
    </div>
  )
}
