import { useState, useEffect } from 'react'
import { IconAlertTriangle, IconCircleCheck } from '@tabler/icons-react'
import { useHomedir } from '../hooks/useHomedir'
import { rpc } from '../rpc'
import type { Worktree, WorktreeStatus } from '../shared/types'

interface DeleteWorktreeModalProps {
  worktree: Worktree
  opened: boolean
  onClose: () => void
  onConfirm: (force: boolean) => void
}

export function DeleteWorktreeModal({ worktree, opened, onClose, onConfirm }: DeleteWorktreeModalProps) {
  const [status, setStatus] = useState<WorktreeStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const { shortenPath } = useHomedir()

  useEffect(() => {
    if (opened) {
      setStatus(null)
      setLoadingStatus(true)
      rpc().request['git:worktreeStatus']({ worktreePath: worktree.path })
        .then(setStatus)
        .catch(() => setStatus(null))
        .finally(() => setLoadingStatus(false))
    }
  }, [opened, worktree.path])

  if (!opened) return null

  const hasWarnings = status?.hasUncommittedChanges || (status?.unpushedCommits ?? 0) > 0

  const handleDelete = () => {
    onConfirm(!!hasWarnings)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-card rounded-lg border shadow-lg max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-foreground mb-4">Delete worktree</h3>

        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground">
            Remove the worktree for <code className="bg-secondary px-1 py-0.5 rounded">{worktree.branch}</code>?
          </p>
          <p className="text-xs text-muted-foreground truncate">{shortenPath(worktree.path)}</p>

          {loadingStatus && (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Checking worktree status...</span>
            </div>
          )}

          {!loadingStatus && status && (
            <>
              {status.hasUncommittedChanges && (
                <div className="bg-warning/10 border border-warning/30 text-warning rounded-md px-3 py-2 text-xs flex items-start gap-2">
                  <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>This worktree has uncommitted changes that will be lost.</span>
                </div>
              )}
              {status.unpushedCommits > 0 && (
                <div className="bg-warning/10 border border-warning/30 text-warning rounded-md px-3 py-2 text-xs flex items-start gap-2">
                  <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{status.unpushedCommits} unpushed commit{status.unpushedCommits === 1 ? '' : 's'} not yet on remote.</span>
                </div>
              )}
              {!hasWarnings && (
                <div className="bg-success/10 border border-success/30 text-success rounded-md px-3 py-2 text-xs flex items-start gap-2">
                  <IconCircleCheck size={14} className="mt-0.5 shrink-0" />
                  <span>No pending changes. Safe to remove.</span>
                </div>
              )}
            </>
          )}

          {!loadingStatus && !status && (
            <div className="bg-warning/10 border border-warning/30 text-warning rounded-md px-3 py-2 text-xs flex items-start gap-2">
              <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>Could not determine worktree status. Proceed with caution.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={onClose}>Cancel</button>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
              onClick={handleDelete}
              disabled={loadingStatus}
            >Delete worktree</button>
          </div>
        </div>
      </div>
    </div>
  )
}
