import { IconGitMerge } from '@tabler/icons-react'
import type { MergeConflictInfo } from '../shared/types'

interface ConflictsBadgeProps {
  conflicts: MergeConflictInfo | null
  loading: boolean
}

export function ConflictsBadge({ conflicts, loading }: ConflictsBadgeProps) {
  if (loading) return null

  if (!conflicts?.hasConflicts) return null

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30 cursor-default"
      title={[
        `${conflicts.conflictCount} merge conflict${conflicts.conflictCount === 1 ? '' : 's'} with ${conflicts.targetBranch}`,
        ...conflicts.conflictFiles.map(f => `  • ${f}`)
      ].join('\n')}
    >
      <IconGitMerge size={12} />
      {conflicts.conflictCount} conflict{conflicts.conflictCount === 1 ? '' : 's'}
    </span>
  )
}
