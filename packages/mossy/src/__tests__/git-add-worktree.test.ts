import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

mock.module('../bun/services/shell-env', () => ({
  getShellEnv: () => Promise.resolve({ PATH: '/usr/bin', HOME: '/tmp' })
}))

import { addWorktree } from '../bun/services/git'

/** Refs the fake repo knows about; drives what rev-parse --verify returns. */
let knownRefs: Set<string>
let commands: string[][]
let spawnSpy: ReturnType<typeof spyOn>

function proc(stdout: string, exitCode = 0) {
  return {
    stdout: new Response(stdout).body,
    stderr: new Response('').body,
    exited: Promise.resolve(exitCode),
    kill: () => {}
  }
}

beforeEach(() => {
  commands = []
  spawnSpy = spyOn(Bun, 'spawn')
  spawnSpy.mockImplementation((cmd: unknown) => {
    const args = cmd as string[]
    commands.push(args)

    if (args[1] === 'rev-parse' && args[2] === '--verify') {
      const ref = args[4]
      return (knownRefs.has(ref) ? proc('abc123\n') : proc('', 1)) as never
    }
    // fetch and worktree add both succeed
    return proc('') as never
  })
})

afterEach(() => spawnSpy.mockRestore())

function gitCalls() {
  return commands.map((c) => c.slice(1).join(' '))
}

describe('addWorktree for an existing branch', () => {
  test('fetches the branch when neither a local nor a tracking ref exists', async () => {
    knownRefs = new Set()

    const result = await addWorktree('/repo', 'teammate/layer', '/wt/layer', false)
    expect(result.success).toBe(true)

    const calls = gitCalls()
    const fetchIdx = calls.findIndex((c) => c.startsWith('fetch origin'))
    const addIdx = calls.findIndex((c) => c.startsWith('worktree add'))

    expect(fetchIdx).toBeGreaterThanOrEqual(0)
    // The fetch must land before the worktree add, or the add still fails
    expect(fetchIdx).toBeLessThan(addIdx)
    expect(calls[fetchIdx]).toBe(
      'fetch origin +refs/heads/teammate/layer:refs/remotes/origin/teammate/layer'
    )
    expect(calls[addIdx]).toBe('worktree add /wt/layer teammate/layer')
  })

  test('skips the fetch when the branch already exists locally', async () => {
    knownRefs = new Set(['refs/heads/mine'])

    await addWorktree('/repo', 'mine', '/wt/mine', false)

    expect(gitCalls().some((c) => c.startsWith('fetch'))).toBe(false)
    expect(gitCalls()).toContain('worktree add /wt/mine mine')
  })

  test('skips the fetch when a tracking ref already exists', async () => {
    knownRefs = new Set(['refs/remotes/origin/known'])

    await addWorktree('/repo', 'known', '/wt/known', false)

    expect(gitCalls().some((c) => c.startsWith('fetch'))).toBe(false)
    expect(gitCalls()).toContain('worktree add /wt/known known')
  })

  test('does not fetch when creating a brand new branch', async () => {
    knownRefs = new Set()

    await addWorktree('/repo', 'feat/new', '/wt/new', true, 'main')

    expect(gitCalls().some((c) => c.startsWith('fetch'))).toBe(false)
    expect(gitCalls()).toContain('worktree add -b feat/new /wt/new main')
  })

  test('reports git errors from the worktree add', async () => {
    knownRefs = new Set(['refs/heads/dup'])
    spawnSpy.mockImplementation((cmd: unknown) => {
      const args = cmd as string[]
      if (args[1] === 'rev-parse') return proc('abc\n') as never
      return {
        stdout: new Response('').body,
        stderr: new Response("fatal: 'dup' is already checked out").body,
        exited: Promise.resolve(128),
        kill: () => {}
      } as never
    })

    const result = await addWorktree('/repo', 'dup', '/wt/dup', false)
    expect(result.success).toBe(false)
    expect(result.error).toContain('already checked out')
  })
})
