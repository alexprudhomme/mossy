import React from 'react'
import { FileEntry } from '../shared/types'

interface FileListItemProps {
  file: FileEntry
  isStaged: boolean
  isSelected: boolean
  onSelect: () => void
  onToggle: () => void
}

const STATUS_LABELS: Record<FileEntry['status'], { letter: string; className: string }> = {
  modified: { letter: 'M', className: 'status-modified' },
  added: { letter: 'A', className: 'status-added' },
  deleted: { letter: 'D', className: 'status-deleted' },
  renamed: { letter: 'R', className: 'status-renamed' },
  untracked: { letter: 'U', className: 'status-untracked' }
}

export function FileListItem({
  file,
  isStaged,
  isSelected,
  onSelect,
  onToggle
}: FileListItemProps): React.ReactElement {
  const statusInfo = STATUS_LABELS[file.status]
  const fileName = file.path.split('/').pop() || file.path
  const dirPath = file.path.includes('/')
    ? file.path.substring(0, file.path.lastIndexOf('/') + 1)
    : ''

  return (
    <div
      className={`file-item ${isSelected ? 'file-item-selected' : ''}`}
      onClick={onSelect}
    >
      <label
        className="file-checkbox-wrapper"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className="file-checkbox"
          checked={isStaged}
          onChange={onToggle}
        />
      </label>
      <div className="file-info">
        <span className="file-name">{fileName}</span>
        {dirPath && <span className="file-dir">{dirPath}</span>}
      </div>
      <span className={`file-status ${statusInfo.className}`}>
        {statusInfo.letter}
      </span>
    </div>
  )
}
