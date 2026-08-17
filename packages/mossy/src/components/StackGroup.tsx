import { IconStack2, IconGitBranch } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { StackEntry } from '../lib/stack-grouping'
import type { StackInfo } from '../shared/types'

interface StackGroupProps {
  stack: StackInfo
  entries: StackEntry[]
  /** Renders the card for a layer that has a local worktree. */
  renderCard: (entry: StackEntry) => ReactNode
}

/**
 * Wraps the worktrees of one `gh stack` in a labelled container. Layers are
 * ordered bottom → top, so the layer closest to the trunk (and first to merge)
 * appears first.
 */
export function StackGroup({ stack, entries, renderCard }: StackGroupProps) {
  const prCount = stack.branches.filter((branch) => branch.prNumber !== null).length
  const missingCount = entries.filter((entry) => entry.worktree === null).length

  return (
    <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.03] px-3 pb-3 pt-2">
      <div className="flex items-center gap-1.5 pb-2 min-w-0">
        <IconStack2 size={14} className="text-violet-300 shrink-0" />
        <span className="text-xs font-semibold text-violet-300 shrink-0">Stack</span>
        <span className="text-[#484f58]">·</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {entries.length} layer{entries.length === 1 ? '' : 's'}
        </span>
        {prCount > 0 && (
          <>
            <span className="text-[#484f58]">·</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {prCount} PR{prCount === 1 ? '' : 's'}
            </span>
          </>
        )}
        <span className="text-[#484f58]">·</span>
        <span className="text-xs text-muted-foreground truncate">
          onto <span className="font-mono">{stack.trunkBranch}</span>
        </span>
        {missingCount > 0 && (
          <span
            className="ml-auto shrink-0 text-[10px] text-muted-foreground"
            title={`${missingCount} layer${missingCount === 1 ? '' : 's'} of this stack ${missingCount === 1 ? 'has' : 'have'} no local worktree`}
          >
            {missingCount} not checked out
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <div key={entry.branch.branch} className="flex items-stretch gap-2">
            <div className="flex flex-col items-center shrink-0 pt-1">
              <span className="text-[10px] font-mono text-violet-300/70 tabular-nums">
                {entry.position}
              </span>
              <div className="flex-1 w-px bg-violet-500/20 mt-1" />
            </div>
            <div className="min-w-0 flex-1">
              {entry.worktree
                ? renderCard(entry)
                : (
                  <div
                    className="flex items-center gap-2 rounded-md border border-dashed border-border/50 px-3 py-1.5 opacity-50"
                    title="This layer of the stack has no local worktree"
                  >
                    <IconGitBranch size={14} className="text-[#484f58] shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {entry.branch.branch}
                    </span>
                    {entry.branch.prNumber !== null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        #{entry.branch.prNumber}
                      </span>
                    )}
                    <span className="text-[10px] text-[#484f58] ml-auto shrink-0">
                      no worktree
                    </span>
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
