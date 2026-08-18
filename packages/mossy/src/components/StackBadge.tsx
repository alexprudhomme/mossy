import { IconStack2 } from '@tabler/icons-react'
import type { StackInfo } from '../shared/types'

interface StackBadgeProps {
  stack: StackInfo
  /** 1-based position, bottom of the stack is 1. */
  position: number
  total: number
}

export function StackBadge({ stack, position, total }: StackBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/30 cursor-default"
      title={[
        `Stack layer ${position} of ${total}`,
        `Trunk: ${stack.trunkBranch}`,
        '',
        ...stack.branches.map((branch, index) => {
          const marker = index + 1 === position ? '→' : ' '
          const pr = branch.prNumber !== null ? ` (#${branch.prNumber})` : ''
          return `${marker} ${index + 1}. ${branch.branch}${pr}`
        })
      ].join('\n')}
    >
      <IconStack2 size={12} />
      {position}/{total}
    </span>
  )
}
