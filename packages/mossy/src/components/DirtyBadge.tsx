import { useState } from 'react'
import { rpc } from '../rpc'
import type { WorktreeStatus } from '../shared/types'

interface DirtyBadgeProps {
  status: WorktreeStatus | null
  loading: boolean
  worktreePath?: string
  onPullComplete?: () => void
}

export function DirtyBadge({ status, loading, worktreePath, onPullComplete }: DirtyBadgeProps) {
  const [pulling, setPulling] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)

  const handlePull = async () => {
    if (!worktreePath || pulling) return
    setPulling(true)
    setPullError(null)
    try {
      const result = await rpc().request['git:pull']({ worktreePath })
      if (result.success) {
        onPullComplete?.()
      } else {
        setPullError(result.error ?? 'Pull failed')
      }
    } catch {
      setPullError('Pull failed')
    } finally {
      setPulling(false)
    }
  }

  if (loading) {
    return <span className="animate-spin h-2.5 w-2.5 border border-[#484f58] border-t-transparent rounded-full" />
  }

  const hasContent = status && (status.linesAdded > 0 || status.linesDeleted > 0 || status.unpushedCommits > 0 || status.unpulledCommits > 0)
  if (!hasContent) return null

  return (
    <div className="flex items-center gap-1 cursor-default" title={[
      status.linesAdded > 0 ? `${status.linesAdded} lines added` : null,
      status.linesDeleted > 0 ? `${status.linesDeleted} lines deleted` : null,
      status.unpushedCommits > 0 ? `${status.unpushedCommits} unpushed` : null,
      status.unpulledCommits > 0 ? `${status.unpulledCommits} unpulled` : null,
      pullError ? `Pull error: ${pullError}` : null,
    ].filter(Boolean).join(', ')}>
      {status.linesAdded > 0 && <span className="text-xs font-semibold text-emerald-400">+{status.linesAdded}</span>}
      {status.linesDeleted > 0 && <span className="text-xs font-semibold text-red-400">-{status.linesDeleted}</span>}
      {status.unpushedCommits > 0 && <span className="text-xs font-semibold text-yellow-400">↑{status.unpushedCommits}</span>}
      {status.unpulledCommits > 0 && (
        pulling
          ? <span className="animate-spin h-2.5 w-2.5 border border-cyan-400 border-t-transparent rounded-full" />
          : <span
              className={`text-xs font-semibold ${pullError ? 'text-red-400' : 'text-cyan-400'} ${worktreePath ? 'cursor-pointer hover:underline' : ''}`}
              onClick={worktreePath ? handlePull : undefined}
            >↓{status.unpulledCommits}</span>
      )}
    </div>
  )
}
