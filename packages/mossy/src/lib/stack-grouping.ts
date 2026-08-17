import type { StackBranchInfo, StackInfo, Worktree } from '../shared/types'

/** One layer of a stack as rendered in the dashboard. */
export interface StackEntry {
  branch: StackBranchInfo
  /** 1-based position, where 1 is the bottom of the stack (closest to trunk). */
  position: number
  /** The local worktree for this layer, or null when the layer has no worktree. */
  worktree: Worktree | null
}

export type WorktreeRow =
  | { kind: 'single'; key: string; worktree: Worktree }
  | { kind: 'stack'; key: string; stack: StackInfo; entries: StackEntry[] }

/** Where a worktree sits in its stack, for the badge on the card. */
export interface StackPlacement {
  stack: StackInfo
  position: number
  total: number
}

function stackKey(stack: StackInfo, index: number): string {
  if (stack.id) return `stack:${stack.id}`
  if (stack.number !== null) return `stack:#${stack.number}`
  return `stack:${stack.trunkBranch}:${stack.branches.map((b) => b.branch).join('>')}:${index}`
}

/**
 * Map every worktree that belongs to a stack to its position in that stack.
 * A branch appearing in more than one stack is attributed to the first.
 */
export function buildStackPlacements(
  worktrees: Worktree[],
  stacks: StackInfo[]
): Map<string, StackPlacement> {
  const byBranch = new Map<string, StackPlacement>()

  for (const stack of stacks) {
    stack.branches.forEach((branch, index) => {
      if (byBranch.has(branch.branch)) return
      byBranch.set(branch.branch, {
        stack,
        position: index + 1,
        total: stack.branches.length
      })
    })
  }

  const placements = new Map<string, StackPlacement>()
  for (const wt of worktrees) {
    const placement = byBranch.get(wt.branch)
    if (placement) placements.set(wt.path, placement)
  }
  return placements
}

/**
 * Turn a flat worktree list into rows, collapsing worktrees that belong to the
 * same `gh stack` into a single group ordered bottom → top.
 *
 * A group is placed as though it were its highest-priority member, so a stack
 * containing an approved PR sorts alongside other approved work. Groups are
 * emitted at the position of their first member, which keeps ordering stable
 * for members that tie on priority.
 */
export function buildWorktreeRows(
  worktrees: Worktree[],
  stacks: StackInfo[],
  sortPriority: (worktree: Worktree) => number
): WorktreeRow[] {
  const relevantStacks = stacks.filter((stack) =>
    stack.branches.some((branch) => worktrees.some((wt) => wt.branch === branch.branch))
  )

  const stackForWorktree = new Map<string, StackInfo>()
  for (const stack of relevantStacks) {
    for (const wt of worktrees) {
      if (stackForWorktree.has(wt.path)) continue
      if (stack.branches.some((branch) => branch.branch === wt.branch)) {
        stackForWorktree.set(wt.path, stack)
      }
    }
  }

  const rows: WorktreeRow[] = []
  const emitted = new Set<StackInfo>()

  for (const wt of worktrees) {
    const stack = stackForWorktree.get(wt.path)

    if (!stack) {
      rows.push({ kind: 'single', key: wt.path, worktree: wt })
      continue
    }

    if (emitted.has(stack)) continue
    emitted.add(stack)

    const members = worktrees.filter((candidate) => stackForWorktree.get(candidate.path) === stack)
    const entries: StackEntry[] = stack.branches.map((branch, index) => ({
      branch,
      position: index + 1,
      worktree: members.find((m) => m.branch === branch.branch) ?? null
    }))

    rows.push({
      kind: 'stack',
      key: stackKey(stack, relevantStacks.indexOf(stack)),
      stack,
      entries
    })
  }

  function rowPriority(row: WorktreeRow): number {
    if (row.kind === 'single') return sortPriority(row.worktree)
    const priorities = row.entries
      .filter((entry) => entry.worktree !== null)
      .map((entry) => sortPriority(entry.worktree as Worktree))
    return priorities.length > 0 ? Math.min(...priorities) : Number.MAX_SAFE_INTEGER
  }

  return rows.sort((a, b) => rowPriority(a) - rowPriority(b))
}
