import React, { useState, useCallback } from 'react'

interface CommitBoxProps {
  branchName: string
  onCommit: (summary: string, description?: string) => void
  hasStaged: boolean
}

export function CommitBox({
  branchName,
  onCommit,
  hasStaged
}: CommitBoxProps): React.ReactElement {
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')

  const handleCommit = useCallback(() => {
    if (!summary.trim() || !hasStaged) return
    onCommit(summary.trim(), description.trim() || undefined)
    setSummary('')
    setDescription('')
  }, [summary, description, hasStaged, onCommit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleCommit()
      }
    },
    [handleCommit]
  )

  return (
    <div className="commit-box">
      <input
        className="commit-summary"
        type="text"
        placeholder="Summary (required)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <textarea
        className="commit-description"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
      />
      <button
        className="commit-btn"
        onClick={handleCommit}
        disabled={!summary.trim() || !hasStaged}
      >
        Commit to <strong>{branchName || '…'}</strong>
      </button>
    </div>
  )
}
