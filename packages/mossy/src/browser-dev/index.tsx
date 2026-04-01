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
    { id: 'demo-1', name: 'gitpeek', path: '/Users/alexprudhomme/dev/gitpeek' },
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

// Stub RPC — returns sensible defaults so the UI can render in a browser
const stubRpc = new Proxy({}, {
  get: (_target, prop) => {
    return async (..._args: unknown[]) => {
      switch (prop) {
        case 'config:get': return DEFAULT_CONFIG
        case 'config:set': return
        case 'config:getCollapsed': return []
        case 'config:setCollapsed': return
        case 'git:worktrees': return [
          { branch: 'main', path: '/Users/dev/gitpeek', isMainWorktree: true },
          { branch: 'feature/diff-panel', path: '/Users/dev/worktrees/gitpeek/feature-diff-panel', isMainWorktree: false },
          { branch: 'fix/styling-bugs', path: '/Users/dev/worktrees/gitpeek/fix-styling-bugs', isMainWorktree: false },
        ]
        case 'git:defaultBranch': return 'main'
        case 'git:remoteBranches': return []
        case 'git:status': return {
          staged: [{ path: 'src/components/App.tsx', status: 'M' }],
          unstaged: [{ path: 'src/styles/global.css', status: 'M' }, { path: 'README.md', status: 'M' }],
          untracked: [{ path: 'src/components/NewWidget.tsx', status: '?' }],
        }
        case 'git:diff': return `--- a/src/styles/global.css\n+++ b/src/styles/global.css\n@@ -1,5 +1,7 @@\n @tailwind base;\n @tailwind components;\n @tailwind utilities;\n+\n+/* Added new theme variables */\n+--primary: 210 40% 50%;\n`
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
