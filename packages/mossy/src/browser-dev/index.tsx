/**
 * Browser dev mode entry point — no Electrobun imports.
 * Sets up window.__electrobun with stub RPC so the UI renders without the native backend.
 */
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from '../components/App'
import '../styles/global.css'
import type { AppConfig } from '../shared/types'

const DEFAULT_CONFIG: AppConfig = {
  repositories: [
    { id: 'demo-1', name: 'mossy', path: '/Users/alexprudhomme/dev/mossy' },
  ],
  worktreeBasePath: '~/Developer/worktrees',
  issueTracker: 'none',
  pollIntervalSec: 60,
  fetchIntervalSec: 300,
  autoUpdateEnabled: false,
  updateCheckIntervalMin: 30,
  collapsedRepos: [],
  defaultIde: 'vscode',
  issuePanelOpen: false,
  issuePanelWidth: 260,
}

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
      switch (prop) {
        case 'config:get': return DEFAULT_CONFIG
        case 'config:set': return
        case 'config:getCollapsed': return []
        case 'config:setCollapsed': return
        case 'git:worktrees': return [
          { branch: 'main', path: '/Users/dev/mossy', isMainWorktree: true },
          { branch: 'feature/diff-panel', path: '/Users/dev/worktrees/mossy/feature-diff-panel', isMainWorktree: false },
          { branch: 'fix/styling-bugs', path: '/Users/dev/worktrees/mossy/fix-styling-bugs', isMainWorktree: false },
        ]
        case 'git:defaultBranch': return 'main'
        case 'git:remoteBranches': return []
        case 'git:status': return {
          staged: [...mockGitState.staged],
          unstaged: [...mockGitState.unstaged],
          untracked: [...mockGitState.untracked],
        }
        case 'git:diff': {
          const payload = args[0] as { filePath?: string } | undefined
          const filePath = payload?.filePath ?? ''
          return MOCK_DIFFS[filePath] ?? ''
        }
        case 'git:stage': {
          const payload = args[0] as { filePaths?: string[] } | undefined
          if (payload?.filePaths) mockStage(payload.filePaths)
          return
        }
        case 'git:unstage': {
          const payload = args[0] as { filePaths?: string[] } | undefined
          if (payload?.filePaths) mockUnstage(payload.filePaths)
          return
        }
        case 'git:commit': return { success: true }
        case 'git:push': return { success: true }
        case 'git:branchInfo': return { name: 'feature/diff-panel', ahead: 2, behind: 0, hasUpstream: true }
        case 'git:worktreeStatus': return { hasUncommittedChanges: true, unpushedCommits: 2, unpulledCommits: 0, linesAdded: 42, linesDeleted: 7 }
        case 'issues:mine': return []
        case 'system:homedir': return '/Users/dev'
        case 'dialog:openDirectory': return prompt('Enter folder path:') || null
        case 'system:dependencies': return { checkedAt: new Date().toISOString(), checks: [] }
        case 'app:checkForUpdates': return { success: true, updateAvailable: false }
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
