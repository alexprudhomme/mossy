import { useState, useCallback } from 'react'
import { IconGitBranch, IconTrash, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { cn } from '../lib/utils'
import { IssueBadge } from './IssueBadge'
import { PRBadge } from './PRBadge'
import { DirtyBadge } from './DirtyBadge'
import { LaunchButtons } from './LaunchButtons'
import { DeleteWorktreeModal } from './DeleteWorktreeModal'
import { DiffPanel } from './DiffPanel'
import { useIssue } from '../hooks/useIssue'
import { usePR } from '../hooks/usePR'
import { useWorktreeStatus } from '../hooks/useWorktreeStatus'
import { useHomedir } from '../hooks/useHomedir'
import { rpc } from '../rpc'
import type { IdeId, IssueTracker, Worktree } from '../shared/types'

interface WorktreeCardProps {
  worktree: Worktree
  repoPath: string
  pollIntervalSec: number
  refreshKey: number
  defaultIde: IdeId
  issueTracker: IssueTracker
  deleting?: boolean
  settingUp?: boolean
  onConfirmDelete: (force: boolean) => void
}

const JIRA_KEY_REGEX = /([a-zA-Z][a-zA-Z0-9]+-\d+)/i
const GH_ISSUE_REGEX = /(?:^|[/-])(\d+)(?:[/-]|$)/

function extractIssueKey(branch: string, tracker: IssueTracker): string | null {
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

export function WorktreeCard({
  worktree, repoPath, pollIntervalSec, refreshKey, defaultIde, issueTracker,
  deleting, settingUp, onConfirmDelete
}: WorktreeCardProps) {
  const [deleteOpened, setDeleteOpened] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const issueKey = extractIssueKey(worktree.branch, issueTracker)
  const { issue, loading: issueLoading } = useIssue(issueKey, pollIntervalSec, refreshKey)
  const { pr, loading: prLoading } = usePR(repoPath, worktree.isMain ? null : worktree.branch, pollIntervalSec, refreshKey)
  const { status: wtStatus, loading: wtStatusLoading, refresh: refreshStatus } = useWorktreeStatus(worktree.path, pollIntervalSec, refreshKey)
  const { shortenPath } = useHomedir()

  const handleDoubleClick = () => {
    if (deleting) return
    rpc().request['launch:ide']({ ideId: defaultIde, worktreePath: worktree.path })
  }

  const toggleExpand = useCallback(() => {
    if (!deleting) setExpanded((prev) => !prev)
  }, [deleting])

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border overflow-hidden transition-all duration-150',
        deleting
          ? 'border-border/50 bg-card/50 opacity-45 pointer-events-none'
          : hovered
            ? 'border-primary/45 bg-gradient-to-br from-primary/[0.08] to-primary/[0.02]'
            : 'border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-4" onDoubleClick={handleDoubleClick}>
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
                <IssueBadge issueKey={issueKey} issue={issue} loading={issueLoading} issueTracker={issueTracker} />
                <PRBadge pr={pr} loading={prLoading} />
                <DirtyBadge status={wtStatus} loading={wtStatusLoading} worktreePath={worktree.path} onPullComplete={refreshStatus} />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <LaunchButtons worktreePath={worktree.path} defaultIde={defaultIde} />
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
