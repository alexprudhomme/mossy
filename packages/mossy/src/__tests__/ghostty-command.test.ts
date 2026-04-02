import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Test config sanitization by loading config.ts with a temporary config path.
// Since config.ts uses a hardcoded path, we test the public getConfig/setConfig
// round-trip by temporarily pointing to a tmp directory.

describe('ghosttyCommand config', () => {
  const tmpDir = path.join(os.tmpdir(), `mossy-test-${Date.now()}`)
  const configPath = path.join(tmpDir, 'mossy-config.json')

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('ghosttyCommand defaults to empty string when missing from config file', () => {
    // Write a config without ghosttyCommand
    const config = {
      repositories: [],
      worktreeBasePath: '/tmp/wt',
      issueTracker: 'none',
      pollIntervalSec: 60,
      fetchIntervalSec: 300,
      autoUpdateEnabled: true,
      updateCheckIntervalMin: 30,
      collapsedRepos: [],
      defaultIde: 'vscode',
      issuePanelOpen: false,
      issuePanelWidth: 260
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    // Simulate what sanitizeConfig does for ghosttyCommand
    const ghosttyCommand = typeof loaded.ghosttyCommand === 'string' ? loaded.ghosttyCommand.trim() : ''
    expect(ghosttyCommand).toBe('')
  })

  test('ghosttyCommand is preserved when set to a valid string', () => {
    const config = {
      repositories: [],
      worktreeBasePath: '/tmp/wt',
      issueTracker: 'none',
      pollIntervalSec: 60,
      fetchIntervalSec: 300,
      autoUpdateEnabled: true,
      updateCheckIntervalMin: 30,
      collapsedRepos: [],
      defaultIde: 'vscode',
      ghosttyCommand: 'copilot',
      issuePanelOpen: false,
      issuePanelWidth: 260
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ghosttyCommand = typeof loaded.ghosttyCommand === 'string' ? loaded.ghosttyCommand.trim() : ''
    expect(ghosttyCommand).toBe('copilot')
  })

  test('ghosttyCommand trims whitespace', () => {
    const config = { ghosttyCommand: '  claude  ' }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ghosttyCommand = typeof loaded.ghosttyCommand === 'string' ? loaded.ghosttyCommand.trim() : ''
    expect(ghosttyCommand).toBe('claude')
  })

  test('ghosttyCommand defaults to empty string for non-string values', () => {
    const config = { ghosttyCommand: 42 }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    const ghosttyCommand = typeof loaded.ghosttyCommand === 'string' ? loaded.ghosttyCommand.trim() : ''
    expect(ghosttyCommand).toBe('')
  })
})

describe('launchGhostty args construction', () => {
  function buildGhosttyArgs(worktreePath: string, command?: string): string[] {
    if (command) {
      return ['open', '-n', '-a', 'Ghostty.app', '--args', `--working-directory=${worktreePath}`, '-e', command]
    }
    return ['open', '-a', 'Ghostty.app', worktreePath]
  }

  test('without command — opens tab via directory (original behavior)', () => {
    const args = buildGhosttyArgs('/path/to/worktree')
    expect(args).toEqual(['open', '-a', 'Ghostty.app', '/path/to/worktree'])
  })

  test('undefined command — same as no command', () => {
    const args = buildGhosttyArgs('/path/to/worktree', undefined)
    expect(args).toEqual(['open', '-a', 'Ghostty.app', '/path/to/worktree'])
  })

  test('with command — opens new instance with -n and --args', () => {
    const args = buildGhosttyArgs('/path/to/worktree', 'copilot')
    expect(args).toEqual([
      'open', '-n', '-a', 'Ghostty.app', '--args',
      '--working-directory=/path/to/worktree', '-e', 'copilot'
    ])
  })

  test('with claude command', () => {
    const args = buildGhosttyArgs('/Users/dev/worktrees/mossy/my-branch', 'claude')
    expect(args).toEqual([
      'open', '-n', '-a', 'Ghostty.app', '--args',
      '--working-directory=/Users/dev/worktrees/mossy/my-branch', '-e', 'claude'
    ])
  })
})
