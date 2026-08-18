import { describe, expect, test } from 'bun:test'
import { mergeStacks, parseStackFile } from '../bun/services/stack'
import { parseStackQueryResponse } from '../bun/services/github'
import type { StackInfo } from '../shared/types'

const SUBMITTED = JSON.stringify({
  schemaVersion: 1,
  repository: 'github.com:coveo/coveo-workplace',
  stacks: [
    {
      id: '415348',
      number: 792,
      trunk: { branch: 'DEV', head: '0ff75ba' },
      branches: [
        { branch: 'chore/ci-tooling-baseline', head: '786b547', base: '32afe49', pullRequest: { number: 786, id: 'PR_1', url: 'https://example.com/786' } },
        { branch: 'chore/bump-stencil-4.44', head: '470dc42', base: '786b547', pullRequest: { number: 789, id: 'PR_2', url: 'https://example.com/789' } }
      ]
    }
  ]
})

/** A copy written before `gh stack submit`: no stack id/number, no heads, no PRs. */
const UNSUBMITTED = JSON.stringify({
  schemaVersion: 1,
  repository: 'github.com:coveo/coveo-workplace',
  stacks: [
    {
      trunk: { branch: 'DEV' },
      branches: [
        { branch: 'chore/ci-tooling-baseline', base: '32afe49' },
        { branch: 'chore/bump-stencil-4.44' }
      ]
    }
  ]
})

describe('parseStackFile', () => {
  test('parses a submitted stack with PR metadata, bottom to top', () => {
    const [stack] = parseStackFile(SUBMITTED)
    expect(stack.id).toBe('415348')
    expect(stack.number).toBe(792)
    expect(stack.trunkBranch).toBe('DEV')
    expect(stack.branches.map((b) => b.branch)).toEqual([
      'chore/ci-tooling-baseline',
      'chore/bump-stencil-4.44'
    ])
    expect(stack.branches[0].prNumber).toBe(786)
    // Each layer is based on the head of the layer below it
    expect(stack.branches[1].base).toBe(stack.branches[0].head)
  })

  test('parses a stack that has not been submitted yet', () => {
    const [stack] = parseStackFile(UNSUBMITTED)
    expect(stack.id).toBeNull()
    expect(stack.number).toBeNull()
    expect(stack.branches[0].head).toBeNull()
    expect(stack.branches[0].prNumber).toBeNull()
  })

  test('returns empty for malformed or unrecognised content', () => {
    expect(parseStackFile('not json')).toEqual([])
    expect(parseStackFile('{}')).toEqual([])
    expect(parseStackFile(JSON.stringify({ stacks: [{ branches: [] }] }))).toEqual([])
    // A stack with a trunk but no usable branches is dropped
    expect(parseStackFile(JSON.stringify({ stacks: [{ trunk: { branch: 'main' }, branches: [{}] }] }))).toEqual([])
  })
})

describe('mergeStacks', () => {
  test('deduplicates copies of the same stack found in different worktrees', () => {
    const merged = mergeStacks([
      { stack: parseStackFile(SUBMITTED)[0], mtimeMs: 2000 },
      { stack: parseStackFile(UNSUBMITTED)[0], mtimeMs: 1000 }
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].number).toBe(792)
  })

  test('backfills metadata missing from the newest copy', () => {
    // Newest copy lacks the id/number and PR data that the older copy has
    const merged = mergeStacks([
      { stack: parseStackFile(UNSUBMITTED)[0], mtimeMs: 5000 },
      { stack: parseStackFile(SUBMITTED)[0], mtimeMs: 1000 }
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('415348')
    expect(merged[0].number).toBe(792)
    expect(merged[0].branches[0].prNumber).toBe(786)
    expect(merged[0].branches[0].head).toBe('786b547')
  })

  test('composition comes from the newest copy, so dropped branches stay dropped', () => {
    const stale: StackInfo = {
      id: '1',
      number: 1,
      trunkBranch: 'main',
      branches: [
        { branch: 'a', head: 'h1', base: null, prNumber: 1, prUrl: null },
        { branch: 'dropped', head: 'h2', base: 'h1', prNumber: 2, prUrl: null },
        { branch: 'b', head: 'h3', base: 'h2', prNumber: 3, prUrl: null }
      ]
    }
    const fresh: StackInfo = {
      id: '1',
      number: 1,
      trunkBranch: 'main',
      branches: [
        { branch: 'a', head: 'h1', base: null, prNumber: 1, prUrl: null },
        { branch: 'b', head: 'h4', base: 'h1', prNumber: 3, prUrl: null }
      ]
    }
    const merged = mergeStacks([
      { stack: stale, mtimeMs: 100 },
      { stack: fresh, mtimeMs: 900 }
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].branches.map((b) => b.branch)).toEqual(['a', 'b'])
  })

  test('keeps genuinely different stacks separate', () => {
    const one: StackInfo = {
      id: null, number: null, trunkBranch: 'main',
      branches: [{ branch: 'a', head: null, base: null, prNumber: null, prUrl: null }]
    }
    const two: StackInfo = {
      id: null, number: null, trunkBranch: 'main',
      branches: [{ branch: 'z', head: null, base: null, prNumber: null, prUrl: null }]
    }
    expect(mergeStacks([{ stack: one, mtimeMs: 1 }, { stack: two, mtimeMs: 2 }])).toHaveLength(2)
  })

  test('does not merge same-named branches across different trunks', () => {
    const dev: StackInfo = {
      id: null, number: null, trunkBranch: 'DEV',
      branches: [{ branch: 'a', head: null, base: null, prNumber: null, prUrl: null }]
    }
    const main: StackInfo = {
      id: null, number: null, trunkBranch: 'main',
      branches: [{ branch: 'a', head: null, base: null, prNumber: null, prUrl: null }]
    }
    expect(mergeStacks([{ stack: dev, mtimeMs: 1 }, { stack: main, mtimeMs: 2 }])).toHaveLength(2)
  })

  test('returns nothing for no records', () => {
    expect(mergeStacks([])).toEqual([])
  })
})

describe('parseStackQueryResponse', () => {
  /** Shape captured from a real `PullRequest.stack` GraphQL response. */
  function response(stacks: unknown) {
    return JSON.stringify({ data: { repository: stacks } })
  }

  const REAL = response({
    s0: {
      nodes: [{
        stack: {
          id: 'S_kwDO1', number: 792, size: 4, baseRefName: 'DEV',
          entries: {
            nodes: [
              { position: 2, pullRequest: { number: 789, url: 'u789', headRefName: 'chore/bump-stencil-4.44' } },
              { position: 1, pullRequest: { number: 786, url: 'u786', headRefName: 'chore/ci-tooling-baseline' } },
              { position: 4, pullRequest: { number: 791, url: 'u791', headRefName: 'feat/externalize-headless' } },
              { position: 3, pullRequest: { number: 787, url: 'u787', headRefName: 'feat/atomic-preview-cdn' } }
            ]
          }
        }
      }]
    }
  })

  test('orders layers by position, not response order', () => {
    const [stack] = parseStackQueryResponse(REAL)
    expect(stack.number).toBe(792)
    expect(stack.trunkBranch).toBe('DEV')
    expect(stack.branches.map((b) => b.branch)).toEqual([
      'chore/ci-tooling-baseline',
      'chore/bump-stencil-4.44',
      'feat/atomic-preview-cdn',
      'feat/externalize-headless'
    ])
    expect(stack.branches.map((b) => b.prNumber)).toEqual([786, 789, 787, 791])
  })

  test('reports no head/base, which only the local files carry', () => {
    const [stack] = parseStackQueryResponse(REAL)
    expect(stack.branches.every((b) => b.head === null && b.base === null)).toBe(true)
  })

  test('a null stack means the PR is not stacked', () => {
    expect(parseStackQueryResponse(response({ s0: { nodes: [{ stack: null }] } }))).toEqual([])
  })

  test('deduplicates when several branches resolve to the same stack', () => {
    const dup = JSON.parse(REAL)
    dup.data.repository.s1 = dup.data.repository.s0
    dup.data.repository.s2 = dup.data.repository.s0
    expect(parseStackQueryResponse(JSON.stringify(dup))).toHaveLength(1)
  })

  test('keeps distinct stacks separate', () => {
    const two = JSON.parse(REAL)
    two.data.repository.s1 = {
      nodes: [{
        stack: {
          id: 'S_kwDO2', number: 800, size: 1, baseRefName: 'main',
          entries: { nodes: [{ position: 1, pullRequest: { number: 900, url: 'u900', headRefName: 'other' } }] }
        }
      }]
    }
    expect(parseStackQueryResponse(JSON.stringify(two))).toHaveLength(2)
  })

  test('survives malformed, empty and partial payloads', () => {
    expect(parseStackQueryResponse('not json')).toEqual([])
    expect(parseStackQueryResponse('{}')).toEqual([])
    expect(parseStackQueryResponse(response({}))).toEqual([])
    expect(parseStackQueryResponse(response({ s0: { nodes: [] } }))).toEqual([])
    // A stack with no baseRefName or no entries is unusable
    expect(parseStackQueryResponse(response({ s0: { nodes: [{ stack: { id: 'x', entries: { nodes: [] } } }] } }))).toEqual([])
    expect(parseStackQueryResponse(response({ s0: { nodes: [{ stack: { id: 'x', baseRefName: 'main', entries: { nodes: [{ position: 1, pullRequest: {} }] } } }] } }))).toEqual([])
  })

  test('tolerates a stack with no id or number yet', () => {
    const [stack] = parseStackQueryResponse(response({
      s0: { nodes: [{ stack: { baseRefName: 'main', entries: { nodes: [{ position: 1, pullRequest: { number: 5, url: 'u5', headRefName: 'a' } }] } } }] }
    }))
    expect(stack.id).toBeNull()
    expect(stack.number).toBeNull()
    expect(stack.branches).toHaveLength(1)
  })
})
