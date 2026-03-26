/**
 * Browser dev mode entry point — no Electrobun imports.
 * Sets up window.__electrobun with fetch-based RPC so hooks work identically.
 */
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from '../components/App'
import '../styles/global.css'

const API_BASE = 'http://localhost:3001'

// Shim window.__electrobun so rpc.ts works without Electrobun
;(window as any).__electrobun = {
  rpc: {
    request: {
      'git:status': async () => {
        const res = await fetch(`${API_BASE}/api/status`)
        return res.json()
      },
      'git:diff': async (params: { filePath: string; staged: boolean }) => {
        const res = await fetch(`${API_BASE}/api/diff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const data = await res.json()
        return data.diff
      },
      'git:stage': async (params: { filePaths: string[] }) => {
        await fetch(`${API_BASE}/api/stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
      },
      'git:unstage': async (params: { filePaths: string[] }) => {
        await fetch(`${API_BASE}/api/unstage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
      },
      'git:commit': async (params: { summary: string; description?: string }) => {
        const res = await fetch(`${API_BASE}/api/commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        return res.json()
      },
      'git:push': async () => {
        const res = await fetch(`${API_BASE}/api/push`, { method: 'POST' })
        return res.json()
      },
      'git:pushSetUpstream': async () => {
        const res = await fetch(`${API_BASE}/api/pushSetUpstream`, { method: 'POST' })
        return res.json()
      },
      'git:branchInfo': async () => {
        const res = await fetch(`${API_BASE}/api/branchInfo`)
        return res.json()
      },
      'app:repoPath': async () => {
        const res = await fetch(`${API_BASE}/api/repoPath`)
        const data = await res.json()
        return data.path
      },
    },
    send: {
      'files:changed': () => {},
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
