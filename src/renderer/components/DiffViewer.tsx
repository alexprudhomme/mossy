import React, { useMemo } from 'react'
import { html as diff2htmlHtml } from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'

interface DiffViewerProps {
  diff: string
  fileName: string | null
}

export function DiffViewer({ diff, fileName }: DiffViewerProps): React.ReactElement {
  const htmlContent = useMemo(() => {
    if (!diff) return ''
    try {
      return diff2htmlHtml(diff, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'line-by-line',
        colorScheme: 'dark'
      })
    } catch {
      return `<pre>${diff}</pre>`
    }
  }, [diff])

  if (!fileName) {
    return (
      <div className="diff-empty">
        <div className="diff-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
        </div>
        <p>Select a file to view changes</p>
      </div>
    )
  }

  return (
    <div className="diff-viewer">
      <div className="diff-header">
        <span className="diff-filename">{fileName}</span>
      </div>
      <div
        className="diff-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  )
}
