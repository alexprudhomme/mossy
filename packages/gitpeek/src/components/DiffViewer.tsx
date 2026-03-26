import React, { useMemo } from 'react'
import { parseDiff, type DiffLine } from '../lib/diff-parser'

interface DiffViewerProps {
  diff: string
  fileName: string | null
  loading: boolean
}

function DiffLineRow({ line }: { line: DiffLine }) {
  if (line.type === 'hunk-header') {
    return (
      <tr className="diff-line diff-line-hunk">
        <td className="diff-gutter diff-gutter-hunk" colSpan={2}>···</td>
        <td className="diff-code diff-code-hunk">{line.content}</td>
      </tr>
    )
  }

  const typeClass = `diff-line-${line.type}`
  const gutterClass = `diff-gutter diff-gutter-${line.type}`
  const codeClass = `diff-code diff-code-${line.type}`

  return (
    <tr className={`diff-line ${typeClass}`}>
      <td className={gutterClass}>
        {line.oldLineNumber ?? ''}
      </td>
      <td className={gutterClass}>
        {line.newLineNumber ?? ''}
      </td>
      <td className={codeClass}>
        <span className="diff-code-marker">
          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
        </span>
        <span className="diff-code-text">{line.content}</span>
      </td>
    </tr>
  )
}

export function DiffViewer({ diff, fileName, loading }: DiffViewerProps): React.ReactElement {
  const parsed = useMemo(() => {
    if (!diff) return null
    try {
      return parseDiff(diff)
    } catch {
      return null
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

  if (loading) {
    return (
      <div className="diff-viewer">
        <div className="diff-header">
          <span className="diff-filename">{fileName}</span>
        </div>
        <div className="diff-empty">
          <div className="spinner" />
          <p>Loading diff…</p>
        </div>
      </div>
    )
  }

  if (parsed?.isBinary) {
    return (
      <div className="diff-viewer">
        <div className="diff-header">
          <span className="diff-filename">{fileName}</span>
        </div>
        <div className="diff-empty">
          <p>Binary file — cannot display diff</p>
        </div>
      </div>
    )
  }

  if (!parsed || parsed.hunks.length === 0) {
    return (
      <div className="diff-viewer">
        <div className="diff-header">
          <span className="diff-filename">{fileName}</span>
          {diff && (
            <span className="diff-badge">
              {parsed?.isNewFile ? 'New file' : parsed?.isDeletedFile ? 'Deleted' : ''}
            </span>
          )}
        </div>
        <div className="diff-empty">
          <p>{diff ? 'No visible changes' : 'No diff available'}</p>
        </div>
      </div>
    )
  }

  // Count additions and deletions
  let additions = 0
  let deletions = 0
  for (const hunk of parsed.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') additions++
      if (line.type === 'removed') deletions++
    }
  }

  return (
    <div className="diff-viewer">
      <div className="diff-header">
        <span className="diff-filename">{fileName}</span>
        <span className="diff-stats">
          {additions > 0 && <span className="diff-stat-add">+{additions}</span>}
          {deletions > 0 && <span className="diff-stat-del">-{deletions}</span>}
        </span>
      </div>
      <div className="diff-content">
        <table className="diff-table">
          <tbody>
            {parsed.hunks.map((hunk, hi) =>
              hunk.lines.map((line, li) => (
                <DiffLineRow key={`${hi}-${li}`} line={line} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
