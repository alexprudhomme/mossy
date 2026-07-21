import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test'
import type { JiraEpic, CreateJiraIssueParams, CreateJiraIssueResult } from '../shared/types'

/**
 * Integration tests for Jira RPC round-trip.
 *
 * The RPC handlers in src/bun/index.ts are thin wrappers over the Jira service
 * functions. These tests verify that the service functions return responses
 * matching the expected RPC response shapes defined in rpc-types.ts.
 *
 * We mock the underlying shell/CLI calls (getShellEnv, Bun.spawn, fs reads)
 * and call the service functions directly, verifying the response shape contracts.
 *
 * Validates: Requirements 3.1, 5.3, 6.1, 6.2, 7.1
 */

// Mock getShellEnv to avoid actual shell lookups
mock.module('../bun/services/shell-env', () => ({
  getShellEnv: () => Promise.resolve(process.env),
}))

describe('Jira RPC endpoint response shapes', () => {
  let spawnSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    spawnSpy = spyOn(Bun, 'spawn')
  })

  afterEach(() => {
    spawnSpy.mockRestore()
  })

  describe('jira:epics', () => {
    test('success response has shape { epics: JiraEpic[] }', async () => {
      const mockEpics = [
        { key: 'PROJ-1', fields: { summary: 'Epic One' } },
        { key: 'PROJ-2', fields: { summary: 'Epic Two' } },
      ]

      spawnSpy.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string[]
        if (cmd.includes('jira') && cmd.includes('epic') && cmd.includes('list')) {
          return {
            stdout: new Response(JSON.stringify(mockEpics)).body,
            stderr: new Response('').body,
            exited: Promise.resolve(0),
            kill: () => {},
          } as any
        }
        return Bun.spawn(...args as [any])
      })

      const { getJiraEpics } = await import('../bun/services/jira')
      const result = await getJiraEpics()

      // Verify shape: { epics: JiraEpic[] }
      expect('epics' in result).toBe(true)
      if ('epics' in result) {
        expect(Array.isArray(result.epics)).toBe(true)
        for (const epic of result.epics) {
          expect(typeof epic.key).toBe('string')
          expect(typeof epic.summary).toBe('string')
        }
      }
    })

    test('error response has shape { error: string }', async () => {
      spawnSpy.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string[]
        if (cmd.includes('jira') && cmd.includes('epic') && cmd.includes('list')) {
          return {
            stdout: new Response('').body,
            stderr: new Response('Project not found').body,
            exited: Promise.resolve(1),
            kill: () => {},
          } as any
        }
        return Bun.spawn(...args as [any])
      })

      const { getJiraEpics } = await import('../bun/services/jira')
      const result = await getJiraEpics()

      // Verify shape: { error: string }
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(typeof result.error).toBe('string')
        expect(result.error.length).toBeGreaterThan(0)
      }
    })
  })

  describe('jira:me', () => {
    test('success response has shape { user: string }', async () => {
      spawnSpy.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string[]
        if (cmd.includes('jira') && cmd.includes('me')) {
          return {
            stdout: new Response('john.doe@example.com\n').body,
            stderr: new Response('').body,
            exited: Promise.resolve(0),
            kill: () => {},
          } as any
        }
        return Bun.spawn(...args as [any])
      })

      const { getJiraCurrentUser } = await import('../bun/services/jira')
      const result = await getJiraCurrentUser()

      // Verify shape: { user: string }
      expect('user' in result).toBe(true)
      if ('user' in result) {
        expect(typeof result.user).toBe('string')
        expect(result.user.length).toBeGreaterThan(0)
      }
    })

    test('error response has shape { error: string }', async () => {
      spawnSpy.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string[]
        if (cmd.includes('jira') && cmd.includes('me')) {
          return {
            stdout: new Response('').body,
            stderr: new Response('Not authenticated').body,
            exited: Promise.resolve(1),
            kill: () => {},
          } as any
        }
        return Bun.spawn(...args as [any])
      })

      const { getJiraCurrentUser } = await import('../bun/services/jira')
      const result = await getJiraCurrentUser()

      // Verify shape: { error: string }
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(typeof result.error).toBe('string')
        expect(result.error.length).toBeGreaterThan(0)
      }
    })
  })

  describe('jira:project', () => {
    test('success response has shape { projectKey: string }', async () => {
      // Mock fs.readFileSync for the config file
      const { readFileSync } = await import('node:fs')
      const originalReadFileSync = readFileSync

      mock.module('node:fs', () => ({
        readFileSync: (path: string, ...rest: any[]) => {
          if (typeof path === 'string' && path.includes('.jira') && path.includes('.config.yml')) {
            return 'server: https://mycompany.atlassian.net\nproject: MYPROJ\n'
          }
          return originalReadFileSync(path, ...rest)
        },
      }))

      const { getJiraProject } = await import('../bun/services/jira')
      const result = await getJiraProject()

      // Verify shape: { projectKey: string }
      expect('projectKey' in result).toBe(true)
      if ('projectKey' in result) {
        expect(typeof result.projectKey).toBe('string')
        expect(result.projectKey.length).toBeGreaterThan(0)
      }
    })

    test('error response has shape { error: string } when config missing', async () => {
      mock.module('node:fs', () => ({
        readFileSync: () => {
          throw new Error('ENOENT: no such file or directory')
        },
      }))

      const { getJiraProject } = await import('../bun/services/jira')
      const result = await getJiraProject()

      // Verify shape: { error: string }
      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(typeof result.error).toBe('string')
        expect(result.error.length).toBeGreaterThan(0)
      }
    })
  })

  describe('jira:createIssue', () => {
    test('success response has shape { success: true, issueKey: string }', async () => {
      spawnSpy.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string[]
        if (cmd.includes('jira') && cmd.includes('me')) {
          return {
            stdout: new Response('john.doe\n').body,
            stderr: new Response('').body,
            exited: Promise.resolve(0),
            kill: () => {},
          } as any
        }
        if (cmd.includes('jira') && cmd.includes('issue') && cmd.includes('create')) {
          return {
            stdout: new Response('OK MYPROJ-456 https://mycompany.atlassian.net/browse/MYPROJ-456\n').body,
            stderr: new Response('').body,
            exited: Promise.resolve(0),
            kill: () => {},
          } as any
        }
        return Bun.spawn(...args as [any])
      })

      mock.module('node:fs', () => ({
        readFileSync: (path: string) => {
          if (typeof path === 'string' && path.includes('.jira') && path.includes('.config.yml')) {
            return 'server: https://mycompany.atlassian.net\nproject: MYPROJ\n'
          }
          throw new Error('ENOENT')
        },
      }))

      const { createJiraIssue } = await import('../bun/services/jira')
      const params: CreateJiraIssueParams = {
        issueType: 'User Story',
        summary: 'Test ticket creation',
      }
      const result: CreateJiraIssueResult = await createJiraIssue(params)

      // Verify shape: { success: true, issueKey: string }
      expect(result.success).toBe(true)
      expect(typeof result.issueKey).toBe('string')
      expect(result.issueKey!.length).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
    })

    test('error response has shape { success: false, error: string }', async () => {
      spawnSpy.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string[]
        if (cmd.includes('jira') && cmd.includes('me')) {
          return {
            stdout: new Response('john.doe\n').body,
            stderr: new Response('').body,
            exited: Promise.resolve(0),
            kill: () => {},
          } as any
        }
        if (cmd.includes('jira') && cmd.includes('issue') && cmd.includes('create')) {
          return {
            stdout: new Response('').body,
            stderr: new Response('Permission denied: cannot create issues in MYPROJ').body,
            exited: Promise.resolve(1),
            kill: () => {},
          } as any
        }
        return Bun.spawn(...args as [any])
      })

      mock.module('node:fs', () => ({
        readFileSync: (path: string) => {
          if (typeof path === 'string' && path.includes('.jira') && path.includes('.config.yml')) {
            return 'server: https://mycompany.atlassian.net\nproject: MYPROJ\n'
          }
          throw new Error('ENOENT')
        },
      }))

      const { createJiraIssue } = await import('../bun/services/jira')
      const params: CreateJiraIssueParams = {
        issueType: 'Bug',
        summary: 'A test bug',
        epicKey: 'MYPROJ-100',
      }
      const result: CreateJiraIssueResult = await createJiraIssue(params)

      // Verify shape: { success: false, error: string }
      expect(result.success).toBe(false)
      expect(typeof result.error).toBe('string')
      expect(result.error!.length).toBeGreaterThan(0)
      expect(result.issueKey).toBeUndefined()
    })

    test('error response when user cannot be resolved', async () => {
      spawnSpy.mockImplementation((...args: any[]) => {
        const cmd = args[0] as string[]
        if (cmd.includes('jira') && cmd.includes('me')) {
          return {
            stdout: new Response('').body,
            stderr: new Response('Not authenticated').body,
            exited: Promise.resolve(1),
            kill: () => {},
          } as any
        }
        return Bun.spawn(...args as [any])
      })

      mock.module('node:fs', () => ({
        readFileSync: (path: string) => {
          if (typeof path === 'string' && path.includes('.jira') && path.includes('.config.yml')) {
            return 'server: https://mycompany.atlassian.net\nproject: MYPROJ\n'
          }
          throw new Error('ENOENT')
        },
      }))

      const { createJiraIssue } = await import('../bun/services/jira')
      const params: CreateJiraIssueParams = {
        issueType: 'Task',
        summary: 'Some task',
      }
      const result: CreateJiraIssueResult = await createJiraIssue(params)

      // Verify shape: { success: false, error: string }
      expect(result.success).toBe(false)
      expect(typeof result.error).toBe('string')
      expect(result.error!.length).toBeGreaterThan(0)
    })
  })
})
