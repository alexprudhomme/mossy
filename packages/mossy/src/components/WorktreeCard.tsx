import { useState, useCallback, useEffect, useMemo } from 'react'
import { IconGitBranch, IconTrash, IconChevronDown, IconChevronRight, IconClockPause } from '@tabler/icons-react'
import { cn } from '../lib/utils'
import { IssueBadge } from './IssueBadge'
import { PRBadge } from './PRBadge'
import { ReviewBadge } from './ReviewBadge'
import { ConflictsBadge } from './ConflictsBadge'
import { DirtyBadge } from './DirtyBadge'
import { StackBadge } from './StackBadge'
import { LaunchButtons } from './LaunchButtons'
import { DeleteWorktreeModal } from './DeleteWorktreeModal'
import { DiffPanel } from './DiffPanel'
import { useIssue } from '../hooks/useIssue'
import { useWorktreeStatus } from '../hooks/useWorktreeStatus'
import { useMergeConflicts } from '../hooks/useMergeConflicts'
import { useHomedir } from '../hooks/useHomedir'
import { rpc } from '../rpc'
import type { StackPlacement } from '../lib/stack-grouping'
import type { IdeId, IssueTracker, PRInfo, TerminalId, Worktree } from '../shared/types'

interface WorktreeCardProps {
  worktree: Worktree
  repoPath: string
  pollIntervalSec: number
  refreshKey: number
  defaultIde: IdeId
  defaultTerminal: TerminalId
  issueTracker: IssueTracker
  pr: PRInfo | null
  prLoading: boolean
  /** Set when this worktree is a layer of a `gh stack`. */
  stackPlacement?: StackPlacement | null
  deleting?: boolean
  settingUp?: boolean
  notReady?: boolean
  suppressHover?: boolean
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
  pr, prLoading, stackPlacement, deleting, settingUp, notReady, suppressHover, onToggleNotReady, onConfirmDelete
}: WorktreeCardProps) {
  const [deleteOpened, setDeleteOpened] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Clear hover state when any drag operation starts
  useEffect(() => {
    if (suppressHover) setHovered(false)
  }, [suppressHover])

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

  // Compact single-line layout for paused (not ready) worktrees
  if (notReady && !deleting) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-1.5 transition-all duration-150',
          (hovered && !suppressHover)
            ? 'border-yellow-500/30 bg-yellow-500/[0.04] opacity-70'
            : 'border-border/40 bg-transparent opacity-50',
        )}
        onMouseEnter={() => { if (!suppressHover) setHovered(true) }}
        onMouseLeave={() => setHovered(false)}
      >
        <IconGitBranch size={14} className="text-[#484f58] shrink-0" />
        <span className="text-xs font-mono text-muted-foreground truncate">
          {worktree.branch}
        </span>
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {stackPlacement && (
            <StackBadge stack={stackPlacement.stack} position={stackPlacement.position} total={stackPlacement.total} />
          )}
          <PRBadge pr={pr} loading={prLoading} />
          <IssueBadge issueKey={issueKey} issue={issue} loading={issueLoading} issueTracker={issueTracker} />
          <LaunchButtons worktreePath={worktree.path} defaultIde={defaultIde} defaultTerminal={defaultTerminal} />
          <button
            title="Mark as ready"
            onClick={onToggleNotReady}
            className="p-0.5 rounded-md bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
          >
            <IconClockPause size={14} />
          </button>
          <button
            title="Delete worktree"
            onClick={() => setDeleteOpened(true)}
            className="p-0.5 rounded-md hover:bg-pink-500/20 text-muted-foreground hover:text-pink-400 transition-colors"
          >
            <IconTrash size={14} />
          </button>
        </div>
        <DeleteWorktreeModal
          worktree={worktree}
          opened={deleteOpened}
          onClose={() => setDeleteOpened(false)}
          onConfirm={onConfirmDelete}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border overflow-hidden transition-all duration-150',
        deleting
          ? 'border-border/50 bg-card/50 opacity-45 pointer-events-none'
          : (hovered && !suppressHover)
            ? 'border-primary/45 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02]'
            : 'border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent',
      )}
      onMouseEnter={() => { if (!suppressHover) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
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
                {stackPlacement && (
                  <StackBadge stack={stackPlacement.stack} position={stackPlacement.position} total={stackPlacement.total} />
                )}
                <ReviewBadge pr={pr} />
                <PRBadge pr={pr} loading={prLoading} />
                <ConflictsBadge conflicts={conflicts} loading={conflictsLoading} />
                <IssueBadge issueKey={issueKey} issue={issue} loading={issueLoading} issueTracker={issueTracker} />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <LaunchButtons worktreePath={worktree.path} defaultIde={defaultIde} defaultTerminal={defaultTerminal} />
                {!worktree.isMain && (
                  <button
                    title="Mark as not ready"
                    onClick={onToggleNotReady}
                    className="p-1 rounded-md text-muted-foreground hover:bg-yellow-500/20 hover:text-yellow-400 transition-colors"
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
