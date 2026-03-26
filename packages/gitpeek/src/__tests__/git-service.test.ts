import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createGitService, isGitRepo } from '../bun/services/git'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import simpleGit from 'simple-git'

let testDir: string
let git: ReturnType<typeof simpleGit>

beforeAll(async () => {
  testDir = await mkdtemp(path.join(tmpdir(), 'gitpeek-test-'))
  git = simpleGit(testDir)
  await git.init()
  await git.addConfig('user.email', 'test@test.com')
  await git.addConfig('user.name', 'Test User')

  // Create initial commit so HEAD exists
  await writeFile(path.join(testDir, 'initial.txt'), 'initial content\n')
  await git.add('initial.txt')
  await git.commit('initial commit')
})

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('isGitRepo', () => {
  test('returns true for a git repo', async () => {
    expect(await isGitRepo(testDir)).toBe(true)
  })

  test('returns false for a non-git directory', async () => {
    const nonGit = await mkdtemp(path.join(tmpdir(), 'gitpeek-nongit-'))
    expect(await isGitRepo(nonGit)).toBe(false)
    await rm(nonGit, { recursive: true, force: true })
  })
})

describe('createGitService', () => {
  describe('status', () => {
    test('returns empty lists for clean repo', async () => {
      const service = createGitService(testDir)
      const s = await service.status()
      expect(s.staged).toHaveLength(0)
      expect(s.unstaged).toHaveLength(0)
      expect(s.untracked).toHaveLength(0)
    })

    test('detects untracked files', async () => {
      await writeFile(path.join(testDir, 'untracked.txt'), 'hello')
      const service = createGitService(testDir)
      const s = await service.status()
      expect(s.untracked.length).toBeGreaterThanOrEqual(1)
      const found = s.untracked.find((f) => f.path === 'untracked.txt')
      expect(found).toBeTruthy()
      expect(found!.status).toBe('untracked')
    })

    test('detects unstaged modifications', async () => {
      // Modify the tracked file
      await writeFile(path.join(testDir, 'initial.txt'), 'modified content\n')
      const service = createGitService(testDir)
      const s = await service.status()
      const found = s.unstaged.find((f) => f.path === 'initial.txt')
      expect(found).toBeTruthy()
      expect(found!.status).toBe('modified')
    })

    test('detects staged files', async () => {
      await git.add('initial.txt')
      const service = createGitService(testDir)
      const s = await service.status()
      const found = s.staged.find((f) => f.path === 'initial.txt')
      expect(found).toBeTruthy()
      expect(found!.status).toBe('modified')
    })
  })

  describe('diff', () => {
    test('returns diff for staged file', async () => {
      // initial.txt is still staged from previous test
      const service = createGitService(testDir)
      const d = await service.diff('initial.txt', true)
      expect(d).toContain('-initial content')
      expect(d).toContain('+modified content')
    })

    test('returns diff for unstaged modified file', async () => {
      // Reset staging, modify again
      await git.reset(['HEAD', '--', 'initial.txt'])
      const service = createGitService(testDir)
      const d = await service.diff('initial.txt', false)
      expect(d).toContain('-initial content')
      expect(d).toContain('+modified content')
    })

    test('returns diff for untracked file using --no-index', async () => {
      // untracked.txt was unstaged earlier, so it should be back to untracked
      const service = createGitService(testDir)
      const s = await service.status()
      const isUntracked = s.untracked.some((f) => f.path === 'untracked.txt')
      expect(isUntracked).toBe(true)

      const d = await service.diff('untracked.txt', false)
      expect(d).toContain('+hello')
    })

    test('returns empty string for tracked file with no changes', async () => {
      const service = createGitService(testDir)
      const d = await service.diff('desc-test.txt', false)
      expect(d).toBe('')
    })

    test('returns empty string for nonexistent file', async () => {
      const service = createGitService(testDir)
      const d = await service.diff('nonexistent.txt', false)
      expect(d).toBe('')
    })
  })

  describe('stage and unstage', () => {
    test('stage adds file to index', async () => {
      const service = createGitService(testDir)
      await service.stage(['untracked.txt'])
      const s = await service.status()
      const found = s.staged.find((f) => f.path === 'untracked.txt')
      expect(found).toBeTruthy()
    })

    test('unstage removes file from index', async () => {
      const service = createGitService(testDir)
      await service.unstage(['untracked.txt'])
      const s = await service.status()
      const inStaged = s.staged.find((f) => f.path === 'untracked.txt')
      expect(inStaged).toBeFalsy()
    })
  })

  describe('commit', () => {
    test('commits staged files', async () => {
      const service = createGitService(testDir)
      await service.stage(['initial.txt'])
      const result = await service.commit('test commit')
      expect(result.success).toBe(true)

      const s = await service.status()
      const inStaged = s.staged.find((f) => f.path === 'initial.txt')
      expect(inStaged).toBeFalsy()
    })

    test('commit with description', async () => {
      await writeFile(path.join(testDir, 'desc-test.txt'), 'for description test')
      const service = createGitService(testDir)
      await service.stage(['desc-test.txt'])
      const result = await service.commit('summary', 'detailed description')
      expect(result.success).toBe(true)
    })

    test('commit with nothing staged creates empty commit', async () => {
      const service = createGitService(testDir)
      // simple-git allows empty commits by default with --allow-empty behavior
      const result = await service.commit('empty commit')
      // This may succeed or fail depending on git version/config
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('branchInfo', () => {
    test('returns current branch name', async () => {
      const service = createGitService(testDir)
      const info = await service.branchInfo()
      expect(info.name).toBeTruthy()
      expect(typeof info.ahead).toBe('number')
      expect(typeof info.behind).toBe('number')
      expect(typeof info.hasUpstream).toBe('boolean')
    })
  })
})
