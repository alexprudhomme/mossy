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
      className="rainbow-approved-pill relative inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border cursor-default"
    >
      <span className="sparkle" aria-hidden>✦</span>
      <span className="sparkle" aria-hidden>✦</span>
      <span className="sparkle" aria-hidden>✦</span>
      <IconUserCheck size={12} className="rainbow-text" />
      <span className="rainbow-text">Approved</span>
    </span>
  )
}
