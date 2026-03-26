import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { Electroview } from 'electrobun/view'
import App from '../components/App'
import '../styles/global.css'
import type { GitPeekRPC } from '../shared/rpc-types'

// --- Electroview RPC setup ---

const rpcInstance = Electroview.defineRPC<GitPeekRPC>({
  maxRequestTime: 60000,
  handlers: {
    requests: {},
    messages: {
      'files:changed': () => {
        window.dispatchEvent(new CustomEvent('gitpeek:files-changed'))
      }
    }
  }
})

const electroview = new Electroview({ rpc: rpcInstance })

// Expose RPC globally so hooks can access it via rpc()
;(window as any).__electrobun = electroview

// --- React mount ---

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
