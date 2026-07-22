import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

mock.module('../bun/services/shell-env', () => ({
  getShellEnv: () => Promise.resolve({ PATH: '/usr/bin', HOME: '/tmp' }),
}))

import { getWorktreeStatus } from '../bun/services/git'

function createMockProc(stdout: string, exitCode = 0) {
  return {
    stdout: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stdout))
        controller.close()
      },
    }),
    stderr: new ReadableStream({
      start(controller) {
        controller.close()
      },
    }),
    exited: Promise.resolve(exitCode),
  }
}

describe('getWorktreeStatus', () => {
  let spawnSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    spawnSpy = spyOn(Bun, 'spawn')
    spawnSpy.mockImplementation((command) => {
      const args = command as string[]
      return createMockProc(args[1] === 'status' ? '' : '') as never
    })
  })

  test('reports a clean worktree without uncommitted changes', async () => {
    const result = await getWorktreeStatus('/worktree')

    expect(result.hasUncommittedChanges).toBe(false)
    expect(result.statusCheckFailed).toBe(false)
  })

  test('keeps a failed status probe distinct from uncommitted changes', async () => {
    spawnSpy.mockImplementation((command) => {
      const args = command as string[]
      return createMockProc('', args[1] === 'status' ? 128 : 0) as never
    })

    const result = await getWorktreeStatus('/worktree')

    expect(result.hasUncommittedChanges).toBe(false)
    expect(result.statusCheckFailed).toBe(true)
  })
})
