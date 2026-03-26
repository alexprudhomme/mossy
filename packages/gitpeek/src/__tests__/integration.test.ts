/**
 * Integration tests that simulate the exact app scenario:
 * - A git repo with tracked/untracked files in various states
 * - Files inside untracked directories (like packages/)
 * - Verifies the full flow: status → select file → get diff → parse → render data
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createGitService } from '../bun/services/git'
import { parseDiff } from '../lib/diff-parser'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import simpleGit from 'simple-git'

let testDir: string
let git: ReturnType<typeof simpleGit>

beforeAll(async () => {
  // Create a repo that mirrors the real gitpeek repo structure
  testDir = await mkdtemp(path.join(tmpdir(), 'gitpeek-integ-'))
  git = simpleGit(testDir)
  await git.init()
  await git.addConfig('user.email', 'test@test.com')
  await git.addConfig('user.name', 'Test User')

  // Create initial tracked files (simulating original repo)
  await writeFile(path.join(testDir, 'package.json'), JSON.stringify({
    name: 'old-project',
    version: '1.0.0',
    dependencies: { electron: '^41.0.0' }
  }, null, 2) + '\n')
  await writeFile(path.join(testDir, '.gitignore'), 'node_modules/\ndist/\n')
  await mkdir(path.join(testDir, 'src'))
  await writeFile(path.join(testDir, 'src', 'index.ts'), 'console.log("hello")\n')

  await git.add('.')
  await git.commit('initial commit')

  // Now simulate the migration state:
  // 1. Modify tracked files (like package.json, .gitignore)
  await writeFile(path.join(testDir, 'package.json'), JSON.stringify({
    private: true,
    workspaces: ['packages/*'],
    scripts: { dev: 'bun run dev' }
  }, null, 2) + '\n')
  await writeFile(path.join(testDir, '.gitignore'), 'node_modules/\ndist/\nbuild/\nbun.lock\n')

  // 2. Delete tracked files
  const { unlink } = await import('fs/promises')
  await unlink(path.join(testDir, 'src', 'index.ts'))

  // 3. Create untracked files in a new directory (like packages/)
  await mkdir(path.join(testDir, 'packages', 'myapp', 'src', 'components'), { recursive: true })
  await writeFile(path.join(testDir, 'packages', 'myapp', 'package.json'), '{ "name": "myapp" }\n')
  await writeFile(path.join(testDir, 'packages', 'myapp', 'src', 'index.ts'), 'export default {}\n')
  await writeFile(path.join(testDir, 'packages', 'myapp', 'src', 'components', 'App.tsx'), '<div>Hello</div>\n')

  // 4. Create a single untracked file at root
  await writeFile(path.join(testDir, 'newfile.txt'), 'brand new content\n')
})

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true })
})

describe('Integration: status → diff → parse pipeline', () => {

  test('status lists all file categories correctly', async () => {
    const service = createGitService(testDir)
    const s = await service.status()

    // Tracked modified files should be in unstaged
    const pkgJson = s.unstaged.find(f => f.path === 'package.json')
    expect(pkgJson).toBeTruthy()
    expect(pkgJson!.status).toBe('modified')

    const gitignore = s.unstaged.find(f => f.path === '.gitignore')
    expect(gitignore).toBeTruthy()

    // Deleted file should appear
    const deleted = s.unstaged.find(f => f.path === 'src/index.ts')
    expect(deleted).toBeTruthy()
    expect(deleted!.status).toBe('deleted')

    // Untracked files/dirs
    expect(s.untracked.length).toBeGreaterThan(0)
    // packages/ appears as a directory or individual files
    const hasPackages = s.untracked.some(f =>
      f.path === 'packages/' || f.path.startsWith('packages/')
    )
    expect(hasPackages).toBe(true)
  })

  test('diff for modified tracked file (package.json) shows additions AND deletions', async () => {
    const service = createGitService(testDir)
    const d = await service.diff('package.json', false)

    expect(d).toBeTruthy()
    expect(d.length).toBeGreaterThan(0)

    // Should contain both removed and added lines
    expect(d).toContain('-')
    expect(d).toContain('+')

    // Parse it and verify structure
    const parsed = parseDiff(d)
    expect(parsed.hunks.length).toBeGreaterThan(0)

    const added = parsed.hunks.flatMap(h => h.lines.filter(l => l.type === 'added'))
    const removed = parsed.hunks.flatMap(h => h.lines.filter(l => l.type === 'removed'))
    expect(added.length).toBeGreaterThan(0)
    expect(removed.length).toBeGreaterThan(0)

    console.log(`  package.json diff: +${added.length} -${removed.length} lines`)
  })

  test('diff for modified tracked file (.gitignore) works', async () => {
    const service = createGitService(testDir)
    const d = await service.diff('.gitignore', false)

    expect(d).toBeTruthy()
    const parsed = parseDiff(d)
    expect(parsed.hunks.length).toBeGreaterThan(0)

    const added = parsed.hunks.flatMap(h => h.lines.filter(l => l.type === 'added'))
    expect(added.length).toBeGreaterThan(0)
  })

  test('diff for deleted tracked file shows all removals', async () => {
    const service = createGitService(testDir)
    const d = await service.diff('src/index.ts', false)

    expect(d).toBeTruthy()
    const parsed = parseDiff(d)
    expect(parsed.hunks.length).toBeGreaterThan(0)

    const removed = parsed.hunks.flatMap(h => h.lines.filter(l => l.type === 'removed'))
    expect(removed.length).toBeGreaterThan(0)
  })

  test('diff for untracked file at root shows all-additions diff', async () => {
    const service = createGitService(testDir)
    const d = await service.diff('newfile.txt', false)

    expect(d).toBeTruthy()
    expect(d).toContain('+++ b/newfile.txt')
    expect(d).toContain('+brand new content')

    const parsed = parseDiff(d)
    expect(parsed.hunks.length).toBeGreaterThan(0)
    const added = parsed.hunks.flatMap(h => h.lines.filter(l => l.type === 'added'))
    expect(added.length).toBeGreaterThan(0)
  })

  test('diff for untracked file INSIDE untracked directory shows diff', async () => {
    const service = createGitService(testDir)

    // This is the key scenario that was broken!
    // packages/myapp/src/index.ts is inside the untracked packages/ directory
    const d = await service.diff('packages/myapp/src/index.ts', false)

    expect(d).toBeTruthy()
    expect(d).toContain('+++ b/packages/myapp/src/index.ts')
    expect(d).toContain('+export default {}')

    const parsed = parseDiff(d)
    expect(parsed.hunks.length).toBeGreaterThan(0)
  })

  test('diff for untracked file deep in nested untracked directory', async () => {
    const service = createGitService(testDir)

    const d = await service.diff('packages/myapp/src/components/App.tsx', false)
    expect(d).toBeTruthy()
    expect(d).toContain('+<div>Hello</div>')
  })

  test('diff for staged modified file shows diff with --cached', async () => {
    // Stage package.json
    await git.add('package.json')

    const service = createGitService(testDir)
    const d = await service.diff('package.json', true)

    expect(d).toBeTruthy()
    const parsed = parseDiff(d)
    const added = parsed.hunks.flatMap(h => h.lines.filter(l => l.type === 'added'))
    const removed = parsed.hunks.flatMap(h => h.lines.filter(l => l.type === 'removed'))
    expect(added.length).toBeGreaterThan(0)
    expect(removed.length).toBeGreaterThan(0)

    // Unstage it for other tests
    await git.reset(['HEAD', '--', 'package.json'])
  })

  test('diff for nonexistent file returns empty', async () => {
    const service = createGitService(testDir)
    const d = await service.diff('does-not-exist.txt', false)
    expect(d).toBe('')
  })

  test('full pipeline: status → select file → diff → parse for every file', async () => {
    const service = createGitService(testDir)
    const s = await service.status()

    const allFiles = [
      ...s.staged.map(f => ({ ...f, staged: true })),
      ...s.unstaged.map(f => ({ ...f, staged: false })),
      ...s.untracked.map(f => ({ ...f, staged: false }))
    ]

    console.log(`\n  Testing full pipeline for ${allFiles.length} files:`)

    for (const file of allFiles) {
      const d = await service.diff(file.path, file.staged)
      const parsed = d ? parseDiff(d) : null
      const hasContent = parsed && parsed.hunks.length > 0

      // Deleted files viewed as unstaged have real diffs
      // Untracked directories might not have individual file diffs
      // But ALL files a user can click should produce SOME diff
      if (file.status === 'deleted') {
        // Deleted files should have removal lines
        expect(d).toBeTruthy()
        console.log(`  ✓ ${file.path} (${file.status}, ${file.staged ? 'staged' : 'unstaged'}) → ${parsed?.hunks.length} hunks`)
      } else if (file.path.endsWith('/')) {
        // Directory entries (like "packages/") — skip, can't diff a directory
        console.log(`  ~ ${file.path} (directory, skipped)`)
      } else {
        expect(d).toBeTruthy()
        expect(hasContent).toBe(true)
        const lines = parsed!.hunks.flatMap(h => h.lines.filter(l => l.type !== 'hunk-header'))
        console.log(`  ✓ ${file.path} (${file.status}, ${file.staged ? 'staged' : 'unstaged'}) → ${lines.length} lines`)
      }
    }
  })
})
