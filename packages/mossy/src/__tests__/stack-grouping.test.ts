import { describe, expect, test } from 'bun:test'
import { buildStackPlacements, buildWorktreeRows } from '../lib/stack-grouping'
import type { StackInfo, Worktree } from '../shared/types'

function wt(branch: string): Worktree {
  return { path: `/wt/${branch}`, branch, head: 'abc', isMain: false }
}

function stack(trunkBranch: string, branches: string[], number: number | null = null): StackInfo {
  return {
    id: number !== null ? String(number) : null,
    number,
    trunkBranch,
    branches: branches.map((branch, i) => ({
      branch,
      head: `h${i}`,
      base: i === 0 ? 'trunk' : `h${i - 1}`,
      prNumber: null,
      prUrl: null
    }))
  }
}

const noPriority = () => 0

describe('buildStackPlacements', () => {
  test('maps stacked worktrees to their 1-based position', () => {
    const worktrees = [wt('a'), wt('b'), wt('solo')]
    const placements = buildStackPlacements(worktrees, [stack('main', ['a', 'b'], 7)])

    expect(placements.get('/wt/a')).toMatchObject({ position: 1, total: 2 })
    expect(placements.get('/wt/b')).toMatchObject({ position: 2, total: 2 })
    expect(placements.has('/wt/solo')).toBe(false)
  })

  test('position reflects the full stack even when layers are not checked out', () => {
    const placements = buildStackPlacements([wt('c')], [stack('main', ['a', 'b', 'c'])])
    expect(placements.get('/wt/c')).toMatchObject({ position: 3, total: 3 })
  })
})

describe('buildWorktreeRows', () => {
  test('collapses stacked worktrees into one row, ordered bottom to top', () => {
    // Deliberately out of stack order
    const worktrees = [wt('b'), wt('a'), wt('solo')]
    const rows = buildWorktreeRows(worktrees, [stack('main', ['a', 'b'], 7)], noPriority)

    expect(rows).toHaveLength(2)
    const stackRow = rows.find((r) => r.kind === 'stack')
    expect(stackRow).toBeDefined()
    if (stackRow?.kind !== 'stack') throw new Error('expected a stack row')
    expect(stackRow.entries.map((e) => e.branch.branch)).toEqual(['a', 'b'])
    expect(stackRow.entries.map((e) => e.position)).toEqual([1, 2])
  })

  test('includes stack layers with no local worktree as gaps', () => {
    const rows = buildWorktreeRows([wt('a'), wt('c')], [stack('main', ['a', 'b', 'c'])], noPriority)
    expect(rows).toHaveLength(1)
    if (rows[0].kind !== 'stack') throw new Error('expected a stack row')

    const entries = rows[0].entries
    expect(entries.map((e) => e.branch.branch)).toEqual(['a', 'b', 'c'])
    expect(entries[0].worktree).not.toBeNull()
    expect(entries[1].worktree).toBeNull()
    expect(entries[2].worktree).not.toBeNull()
  })

  test('ignores stacks with no local worktrees at all', () => {
    const rows = buildWorktreeRows([wt('solo')], [stack('main', ['x', 'y'])], noPriority)
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('single')
  })

  test('a stack sorts by its highest-priority member', () => {
    const worktrees = [wt('mid'), wt('low'), wt('stackTop'), wt('stackBottom')]
    const priorities: Record<string, number> = {
      mid: 2,
      low: 5,
      stackBottom: 4,
      stackTop: 1 // best in the stack — should pull the whole group to the front
    }
    const rows = buildWorktreeRows(
      worktrees,
      [stack('main', ['stackBottom', 'stackTop'])],
      (w) => priorities[w.branch]
    )

    expect(rows[0].kind).toBe('stack')
    expect(rows.map((r) => (r.kind === 'single' ? r.worktree.branch : 'STACK')))
      .toEqual(['STACK', 'mid', 'low'])
  })

  test('returns plain singles when there are no stacks', () => {
    const rows = buildWorktreeRows([wt('a'), wt('b')], [], noPriority)
    expect(rows.map((r) => r.kind)).toEqual(['single', 'single'])
  })

  test('handles multiple independent stacks', () => {
    const rows = buildWorktreeRows(
      [wt('a1'), wt('b1'), wt('a2'), wt('b2')],
      [stack('main', ['a1', 'a2'], 1), stack('main', ['b1', 'b2'], 2)],
      noPriority
    )
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.kind === 'stack')).toBe(true)
    // Row keys must be distinct so React can reconcile them
    expect(new Set(rows.map((r) => r.key)).size).toBe(2)
  })

  test('attributes a branch in two stacks to only one row', () => {
    const rows = buildWorktreeRows(
      [wt('shared')],
      [stack('main', ['shared'], 1), stack('main', ['shared'], 2)],
      noPriority
    )
    expect(rows).toHaveLength(1)
  })
})
