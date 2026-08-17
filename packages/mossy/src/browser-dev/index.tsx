/**
 * Browser dev mode entry point — no Electrobun imports.
 * Sets up window.__electrobun with stub RPC so the UI renders without the native backend.
 */
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from '../components/App'
import '../styles/global.css'
import type { AppConfig } from '../shared/types'

// Generate many repos for scroll testing
const MANY_REPOS = Array.from({ length: 8 }, (_, i) => ({
  id: `repo-${i + 1}`,
  name: `project-${i + 1}`,
  path: `/Users/dev/projects/project-${i + 1}`,
}))

const DEFAULT_CONFIG: AppConfig = {
  repositories: MANY_REPOS,
  worktreeBasePath: '~/Developer/worktrees',
  issueTracker: 'jira',
  pollIntervalSec: 120,
  fetchIntervalSec: 300,
  autoUpdateEnabled: false,
  updateCheckIntervalMin: 30,
  collapsedRepos: [],
  defaultIde: 'vscode',
  defaultTerminal: 'ghostty',
  issuePanelOpen: true,
  issuePanelWidth: 260,
  dismissedDependencyWarning: false,
  zoomLevel: 1,
  notReadyWorktrees: [],
}

// Generate many mock issues for scroll testing
const MOCK_ISSUES = Array.from({ length: 20 }, (_, i) => ({
  key: `KIT-${1000 + i}`,
  summary: `Issue ${i + 1}: ${['Fix scrolling bug', 'Add new feature', 'Refactor component', 'Update dependencies', 'Write documentation'][i % 5]}`,
  status: ['In Progress', 'In Review', 'Accepted', 'On Hold', 'Merged', 'New', 'Upcoming', 'Done', 'Ready for implementation', 'In Progress'][i % 10],
  assignee: 'dev-user',
  issueType: ['Bug', 'Story', 'Task'][i % 3],
  url: `https://coveord.atlassian.net/browse/KIT-${1000 + i}`,
}))

// Mock diffs keyed by file path for realistic testing
const MOCK_DIFFS: Record<string, string> = {
  'src/components/App.tsx': [
    'diff --git a/src/components/App.tsx b/src/components/App.tsx',
    'index 1a2b3c4..5d6e7f8 100644',
    '--- a/src/components/App.tsx',
    '+++ b/src/components/App.tsx',
    '@@ -12,7 +12,9 @@ export default function App() {',
    '   const [config, setConfig] = useState<AppConfig | null>(null)',
    '   const [settingsOpen, setSettingsOpen] = useState(false)',
    ' ',
    '-  useEffect(() => {',
    '+  // Refresh config on mount and when settings change',
    '+  const refreshConfig = useCallback(async () => {',
    '+    const cfg = await rpc().request[\'config:get\']()',
    '+    setConfig(cfg)',
    '   }, [])',
    ' ',
    '   return (',
  ].join('\n'),
  'src/styles/global.css': [
    'diff --git a/src/styles/global.css b/src/styles/global.css',
    'index aaa1111..bbb2222 100644',
    '--- a/src/styles/global.css',
    '+++ b/src/styles/global.css',
    '@@ -1,5 +1,7 @@',
    ' @tailwind base;',
    ' @tailwind components;',
    ' @tailwind utilities;',
    '+',
    '+/* Added new theme variables */',
    '+--primary: 210 40% 50%;',
  ].join('\n'),
  'README.md': [
    'diff --git a/README.md b/README.md',
    'index ccc3333..ddd4444 100644',
    '--- a/README.md',
    '+++ b/README.md',
    '@@ -1,4 +1,6 @@',
    ' # Mossy',
    ' ',
    '-A git worktree management dashboard.',
    '+A git worktree management dashboard built with Electrobun.',
    '+',
    '+> Manage all your worktrees from one place.',
  ].join('\n'),
  'src/components/NewWidget.tsx': [
    'diff --git a/src/components/NewWidget.tsx b/src/components/NewWidget.tsx',
    'new file mode 100644',
    'index 0000000..eee5555',
    '--- /dev/null',
    '+++ b/src/components/NewWidget.tsx',
    '@@ -0,0 +1,12 @@',
    '+import { useState } from \'react\'',
    '+',
    '+export function NewWidget() {',
    '+  const [count, setCount] = useState(0)',
    '+',
    '+  return (',
    '+    <div className="p-4">',
    '+      <h2>Widget</h2>',
    '+      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>',
    '+    </div>',
    '+  )',
    '+}',
  ].join('\n'),
}

// Mutable mock git state so staging/unstaging works in browser dev
interface MockFile { path: string; status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' }
const mockGitState = {
  staged: [{ path: 'src/components/App.tsx', status: 'modified' }] as MockFile[],
  unstaged: [
    { path: 'src/styles/global.css', status: 'modified' },
    { path: 'README.md', status: 'modified' },
  ] as MockFile[],
  untracked: [{ path: 'src/components/NewWidget.tsx', status: 'untracked' }] as MockFile[],
}

function mockStage(filePaths: string[]) {
  for (const fp of filePaths) {
    // Move from unstaged/untracked → staged
    let idx = mockGitState.unstaged.findIndex(f => f.path === fp)
    if (idx !== -1) {
      const [file] = mockGitState.unstaged.splice(idx, 1)
      mockGitState.staged.push(file)
      continue
    }
    idx = mockGitState.untracked.findIndex(f => f.path === fp)
    if (idx !== -1) {
      const [file] = mockGitState.untracked.splice(idx, 1)
      mockGitState.staged.push({ ...file, status: 'added' })
    }
  }
}

function mockUnstage(filePaths: string[]) {
  for (const fp of filePaths) {
    const idx = mockGitState.staged.findIndex(f => f.path === fp)
    if (idx !== -1) {
      const [file] = mockGitState.staged.splice(idx, 1)
      if (file.status === 'added') {
        mockGitState.untracked.push({ ...file, status: 'untracked' })
      } else {
        mockGitState.unstaged.push(file)
      }
    }
  }
}

// Stub RPC — returns sensible defaults so the UI can render in a browser
const stubRpc = new Proxy({}, {
  get: (_target, prop) => {
    return async (...args: unknown[]) => {
      const payload = args[0] as Record<string, unknown> | undefined
      const repoPath = (payload?.repoPath ?? payload?.worktreePath ?? '') as string

      // Generate worktrees per repo for realistic scroll testing
      const worktreesForRepo = (basePath: string) => {
        const repoName = basePath.split('/').pop() ?? 'repo'
        return [
          { branch: 'main', path: basePath, isMainWorktree: true },
          ...Array.from({ length: 5 }, (_, i) => ({
            branch: `feature/${repoName}-${i + 1}`,
            path: `/Users/dev/worktrees/${repoName}/feature-${i + 1}`,
            isMainWorktree: false,
          })),
        ]
      }

      switch (prop) {
        case 'config:get': return DEFAULT_CONFIG
        case 'config:set': return
        case 'config:getCollapsed': return []
        case 'config:setCollapsed': return
        case 'git:worktrees': return worktreesForRepo(repoPath)
        case 'git:defaultBranch': return 'main'
        case 'git:remoteBranches': return []
        case 'git:status': return {
          staged: [...mockGitState.staged],
          unstaged: [...mockGitState.unstaged],
          untracked: [...mockGitState.untracked],
        }
        case 'git:diff': {
          const filePath = (payload?.filePath ?? '') as string
          return MOCK_DIFFS[filePath] ?? ''
        }
        case 'git:stage': {
          if (payload?.filePaths) mockStage(payload.filePaths as string[])
          return
        }
        case 'git:unstage': {
          if (payload?.filePaths) mockUnstage(payload.filePaths as string[])
          return
        }
        case 'git:commit': return { success: true }
        case 'git:push': return { success: true }
        case 'git:pull': return { success: true }
        case 'git:branchInfo': return { name: 'feature/diff-panel', ahead: 2, behind: 0, hasUpstream: true }
        case 'git:worktreeStatus': return { hasUncommittedChanges: true, statusCheckFailed: false, unpushedCommits: 2, unpulledCommits: 0, linesAdded: 42, linesDeleted: 7 }
        case 'git:mergeConflicts': return { hasConflicts: false, conflictCount: 0, conflictFiles: [], targetBranch: 'main' }
        case 'gh:pr': return { number: 42, url: 'https://github.com/example/mossy/pull/42', title: 'feat: example PR', state: 'OPEN', isDraft: false, reviewDecision: 'APPROVED', ciStatus: 'SUCCESS', ciFailed: 0, ciTotal: 3 }
        case 'gh:rateLimit': return { limited: false, resetsAt: null }
        case 'gh:stacks': {
          const repoName = repoPath.split('/').pop() ?? 'repo'
          return [
            {
              id: 'STACK_kwDOdev',
              number: 7,
              trunkBranch: 'main',
              branches: [
                { branch: `feature/${repoName}-1`, head: 'aaa1', base: 'trunk0', prNumber: 101, prUrl: 'https://github.com/example/mossy/pull/101' },
                { branch: `feature/${repoName}-3`, head: 'aaa2', base: 'aaa1', prNumber: 102, prUrl: 'https://github.com/example/mossy/pull/102' },
                { branch: `feature/${repoName}-not-local`, head: 'aaa3', base: 'aaa2', prNumber: 103, prUrl: 'https://github.com/example/mossy/pull/103' },
              ],
            },
          ]
        }
        case 'issues:mine': return MOCK_ISSUES
        case 'system:homedir': return '/Users/dev'
        case 'dialog:openDirectory': return prompt('Enter folder path:') || null
        case 'system:dependencies': return { checkedAt: new Date().toISOString(), checks: [] }
        case 'app:version': return '0.0.0-dev'
        case 'app:toggleZoom': return
        case 'app:quit': return
        case 'app:closeWindow': return
        case 'app:checkForUpdates': return { success: true, updateAvailable: false }
        case 'launch:githubDesktop': return
        case 'git:fetch': return { success: true }
        default: return null
      }
    }
  }
})

;(window as any).__electrobun = {
  rpc: {
    request: stubRpc,
    send: new Proxy({}, { get: () => () => {} }),
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
