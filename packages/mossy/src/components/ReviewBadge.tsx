import { IconUserCheck } from '@tabler/icons-react'
import type { PRInfo } from '../shared/types'

interface ReviewBadgeProps {
  pr: PRInfo | null
}

export function ReviewBadge({ pr }: ReviewBadgeProps) {
  if (!pr || pr.reviewDecision !== 'APPROVED') return null

  return (
    <span
      title="Approved"
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-default bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    >
      <IconUserCheck size={12} />
      Approved
    </span>
  )
}
