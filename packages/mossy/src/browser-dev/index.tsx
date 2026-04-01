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
  repositories: [],
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
        case 'git:worktrees': return []
        case 'git:defaultBranch': return 'main'
        case 'git:remoteBranches': return []
        case 'git:status': return { staged: [], unstaged: [], untracked: [] }
        case 'git:branchInfo': return { name: 'main', ahead: 0, behind: 0, hasUpstream: true }
        case 'git:worktreeStatus': return { hasUncommittedChanges: false, unpushedCommits: 0, unpulledCommits: 0, linesAdded: 0, linesDeleted: 0 }
        case 'issues:mine': return []
        case 'system:homedir': return '/Users/dev'
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
