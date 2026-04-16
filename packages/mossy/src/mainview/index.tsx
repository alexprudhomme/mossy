import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { Electroview } from 'electrobun/view'
import App from '../components/App'
import '../styles/global.css'
import type { MossyRPC } from '../shared/rpc-types'

// --- Electroview RPC setup ---

const rpc = Electroview.defineRPC<MossyRPC>({
  maxRequestTime: 300000,
  handlers: {
    requests: {},
    messages: {
      'ui:openSettings': () => {
        window.dispatchEvent(new CustomEvent('mossy:open-settings'))
      },
      'ui:zoomIn': () => {
        window.dispatchEvent(new CustomEvent('mossy:zoom-in'))
      },
      'ui:zoomOut': () => {
        window.dispatchEvent(new CustomEvent('mossy:zoom-out'))
      },
      'ui:zoomReset': () => {
        window.dispatchEvent(new CustomEvent('mossy:zoom-reset'))
      }
    }
  }
})

const electroview = new Electroview({ rpc })

// Expose the RPC instance globally so hooks can access it
;(window as any).__electrobun = electroview

// --- React mount ---

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
