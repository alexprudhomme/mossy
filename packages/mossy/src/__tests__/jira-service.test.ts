import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test'

// Mock shell-env to avoid spawning a real shell
mock.module('../bun/services/shell-env', () => ({
  getShellEnv: () => Promise.resolve({ PATH: '/usr/bin', HOME: '/home/test' }),
}))

// Mock node:fs and node:os for getJiraProject
mock.module('node:fs', () => ({
  readFileSync: (path: string) => {
    if (path.includes('.jira') && path.includes('.config.yml')) {
      return 'server: https://mycompany.atlassian.net\nproject: PROJ\n'
    }
    throw new Error('File not found')
  },
}))

mock.module('node:os', () => ({
  homedir: () => '/home/test',
}))

import {
  getJiraEpics,
  createJiraIssue,
} from '../bun/services/jira'

/**
 * Helper to create a mock subprocess that simulates Bun.spawn behavior.
 */
function createMockProc(options: {
  stdout?: string
  stderr?: string
  exitCode?: number
  shouldTimeout?: boolean
}) {
  const { stdout = '', stderr = '', exitCode = 0, shouldTimeout = false } = options

  const stdoutStream = new ReadableStream({
    start(controller) {
      if (!shouldTimeout) {
        controller.enqueue(new TextEncoder().encode(stdout))
        controller.close()
      }
      // If shouldTimeout, we never close — simulating a hanging process
    },
  })

  const stderrStream = new ReadableStream({
    start(controller) {
      if (!shouldTimeout) {
        controller.enqueue(new TextEncoder().encode(stderr))
        controller.close()
      }
    },
  })

  const proc = {
    stdout: stdoutStream,
    stderr: stderrStream,
    exited: shouldTimeout
      ? new Promise<number>(() => {}) // Never resolves — timeout will kill it
      : Promise.resolve(exitCode),
    kill: mock(() => {}),
    pid: 1234,
  }

  return proc
}

describe('getJiraEpics', () => {
  let spawnSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    spawnSpy = spyOn(Bun, 'spawn')
  })

  test('success: returns parsed epics from JSON output', async () => {
    const epicsData = [
      { key: 'PROJ-1', fields: { summary: 'Epic One' } },
      { key: 'PROJ-2', fields: { summary: 'Epic Two' } },
    ]
    const mockProc = createMockProc({
      stdout: JSON.stringify(epicsData),
      exitCode: 0,
    })
    spawnSpy.mockReturnValue(mockProc as any)

    const result = await getJiraEpics()

    expect(result).toEqual({
      epics: [
        { key: 'PROJ-1', summary: 'Epic One' },
        { key: 'PROJ-2', summary: 'Epic Two' },
      ],
    })
  })

  test('success: caps results at 50 epics when more are available', async () => {
    const epicsData = Array.from({ length: 75 }, (_, i) => ({
      key: `PROJ-${i + 1}`,
      fields: { summary: `Epic ${i + 1}` },
    }))
    const mockProc = createMockProc({
      stdout: JSON.stringify(epicsData),
      exitCode: 0,
    })
    spawnSpy.mockReturnValue(mockProc as any)

    const result = await getJiraEpics()

    expect('epics' in result).toBe(true)
    if ('epics' in result) {
      expect(result.epics).toHaveLength(50)
      expect(result.epics[0]).toEqual({ key: 'PROJ-1', summary: 'Epic 1' })
      expect(result.epics[49]).toEqual({ key: 'PROJ-50', summary: 'Epic 50' })
    }
  })

  test('failure: returns error when CLI exits with non-zero code', async () => {
    const mockProc = createMockProc({
      stdout: '',
      stderr: 'no epics found',
      exitCode: 1,
    })
    spawnSpy.mockReturnValue(mockProc as any)

    const result = await getJiraEpics()

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('no epics found')
    }
  })

  test('failure: returns error when response is not an array', async () => {
    const mockProc = createMockProc({
      stdout: '{"notAnArray": true}',
      exitCode: 0,
    })
    spawnSpy.mockReturnValue(mockProc as any)

    const result = await getJiraEpics()

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toBe('Unexpected response format from Jira CLI')
    }
  })

  test('calls jira CLI with correct arguments', async () => {
    const mockProc = createMockProc({
      stdout: '[]',
      exitCode: 0,
    })
    spawnSpy.mockReturnValue(mockProc as any)

    await getJiraEpics()

    expect(spawnSpy).toHaveBeenCalledWith(
      ['jira', 'epic', 'list', '--raw'],
      expect.objectContaining({ stdout: 'pipe', stderr: 'pipe' })
    )
  })
})

describe('createJiraIssue', () => {
  let spawnSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    spawnSpy = spyOn(Bun, 'spawn')
  })

  /**
   * Helper: returns a mock for `jira me` (first spawn call) followed by the
   * actual create command (second spawn call).
   */
  function mockMeAndCreate(createOpts: Parameters<typeof createMockProc>[0], meUser = 'user@example.com') {
    const meMock = createMockProc({ stdout: meUser, exitCode: 0 })
    const createMock = createMockProc(createOpts)
    const calls: any[][] = []
    spawnSpy.mockImplementation((...args: any[]) => {
      calls.push(args)
      // First call is `jira me`, subsequent calls are the create command
      if (calls.length === 1) return meMock as any
      return createMock as any
    })
    return calls
  }

  test('success: creates issue and returns issue key', async () => {
    mockMeAndCreate({
      stdout: 'OK PROJ-123 https://mycompany.atlassian.net/browse/PROJ-123',
      exitCode: 0,
    })

    const result = await createJiraIssue({
      issueType: 'Bug',
      summary: 'Fix login issue',
    })

    expect(result).toEqual({ success: true, issueKey: 'PROJ-123' })
  })

  test('success: passes assignee via -a flag from jira me', async () => {
    const spawnCalls = mockMeAndCreate({
      stdout: 'OK PROJ-123 https://mycompany.atlassian.net/browse/PROJ-123',
      exitCode: 0,
    }, 'john@company.com')

    await createJiraIssue({
      issueType: 'Bug',
      summary: 'Fix login issue',
    })

    // Second call is the create command
    const createCall = spawnCalls.find(
      (call) => call[0][0] === 'jira' && call[0][1] === 'issue' && call[0][2] === 'create'
    )
    expect(createCall).toBeDefined()
    if (createCall) {
      const args = createCall[0] as string[]
      expect(args).toContain('-ajohn@company.com')
    }
  })

  test('success: creates issue without assignee when jira me fails', async () => {
    const meMock = createMockProc({ stdout: '', exitCode: 1 })
    const createMock = createMockProc({
      stdout: 'OK PROJ-123 https://mycompany.atlassian.net/browse/PROJ-123',
      exitCode: 0,
    })
    const calls: any[][] = []
    spawnSpy.mockImplementation((...args: any[]) => {
      calls.push(args)
      if (calls.length === 1) return meMock as any
      return createMock as any
    })

    const result = await createJiraIssue({
      issueType: 'Bug',
      summary: 'Fix login issue',
    })

    expect(result).toEqual({ success: true, issueKey: 'PROJ-123' })

    // The create call should NOT have -a flag
    const createCall = calls.find(
      (call) => call[0][0] === 'jira' && call[0][1] === 'issue' && call[0][2] === 'create'
    )
    expect(createCall).toBeDefined()
    if (createCall) {
      const args = createCall[0] as string[]
      const hasAssigneeFlag = args.some((arg: string) => arg.startsWith('-a'))
      expect(hasAssigneeFlag).toBe(false)
    }
  })

  test('success: passes epic key as -P flag when epicKey is provided', async () => {
    const spawnCalls = mockMeAndCreate({
      stdout: 'OK PROJ-456 https://mycompany.atlassian.net/browse/PROJ-456',
      exitCode: 0,
    })

    const result = await createJiraIssue({
      issueType: 'User Story',
      summary: 'Add feature',
      epicKey: 'PROJ-100',
    })

    expect(result).toEqual({ success: true, issueKey: 'PROJ-456' })

    // Find the create issue call
    const createCall = spawnCalls.find(
      (call) => call[0][0] === 'jira' && call[0][1] === 'issue' && call[0][2] === 'create'
    )
    expect(createCall).toBeDefined()
    if (createCall) {
      const args = createCall[0] as string[]
      expect(args).toContain('-tUser Story')
      expect(args).toContain('-sAdd feature')
      expect(args).toContain('-PPROJ-100')
      // Should NOT include -p flag (project comes from jira-cli config)
      const hasProjectFlag = args.some((arg: string) => arg.startsWith('-p'))
      expect(hasProjectFlag).toBe(false)
    }
  })

  test('failure: returns error when CLI exits with non-zero code', async () => {
    mockMeAndCreate({
      stdout: '',
      stderr: 'Permission denied',
      exitCode: 1,
    })

    const result = await createJiraIssue({
      issueType: 'Bug',
      summary: 'Some issue',
    })

    expect(result).toEqual({ success: false, error: 'Permission denied' })
  })

  test('failure: returns error when issue key cannot be parsed from stdout', async () => {
    mockMeAndCreate({
      stdout: 'Some unexpected output without a key',
      exitCode: 0,
    })

    const result = await createJiraIssue({
      issueType: 'Bug',
      summary: 'Some issue',
    })

    expect(result).toEqual({
      success: false,
      error: 'Issue created but could not parse issue key from response',
    })
  })

  test('does not include -P flag when epicKey is not provided', async () => {
    const spawnCalls = mockMeAndCreate({
      stdout: 'OK PROJ-789 https://mycompany.atlassian.net/browse/PROJ-789',
      exitCode: 0,
    })

    await createJiraIssue({
      issueType: 'Task',
      summary: 'No epic',
    })

    const createCall = spawnCalls.find(
      (call) => call[0][0] === 'jira' && call[0][1] === 'issue' && call[0][2] === 'create'
    )
    expect(createCall).toBeDefined()
    if (createCall) {
      const args = createCall[0] as string[]
      const hasParentFlag = args.some((arg: string) => arg.startsWith('-P'))
      expect(hasParentFlag).toBe(false)
    }
  })
})
