import React from 'react'
import { FileEntry } from '../shared/types'
import { FileListItem } from './FileListItem'

interface FileListProps {
  staged: FileEntry[]
  unstaged: FileEntry[]
  untracked: FileEntry[]
  loading: boolean
  selectedFile: FileEntry | null
  selectedFileStaged: boolean
  onSelectFile: (file: FileEntry, staged: boolean) => void
  onToggleFile: (file: FileEntry, isCurrentlyStaged: boolean) => void
}

export function FileList({
  staged,
  unstaged,
  untracked,
  loading,
  selectedFile,
  selectedFileStaged,
  onSelectFile,
  onToggleFile
}: FileListProps): React.ReactElement {
  const allUnstaged = [...unstaged, ...untracked]

  if (loading) {
    return (
      <div className="file-list">
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading changes…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="file-list">
      {staged.length > 0 && (
        <div className="file-group">
          <div className="file-group-header">
            Staged Changes
            <span className="file-count">{staged.length}</span>
          </div>
          {staged.map((file) => (
            <FileListItem
              key={`staged-${file.path}`}
              file={file}
              isStaged={true}
              isSelected={
                selectedFile?.path === file.path && selectedFileStaged
              }
              onSelect={() => onSelectFile(file, true)}
              onToggle={() => onToggleFile(file, true)}
            />
          ))}
        </div>
      )}
      {allUnstaged.length > 0 && (
        <div className="file-group">
          <div className="file-group-header">
            Changes
            <span className="file-count">{allUnstaged.length}</span>
          </div>
          {allUnstaged.map((file) => (
            <FileListItem
              key={`unstaged-${file.path}`}
              file={file}
              isStaged={false}
              isSelected={
                selectedFile?.path === file.path && !selectedFileStaged
              }
              onSelect={() => onSelectFile(file, false)}
              onToggle={() => onToggleFile(file, false)}
            />
          ))}
        </div>
      )}
      {staged.length === 0 && allUnstaged.length === 0 && (
        <div className="no-changes">No changes</div>
      )}
    </div>
  )
}
