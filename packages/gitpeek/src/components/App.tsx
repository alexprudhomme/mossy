import React, { useState, useCallback } from 'react'
import { FileEntry } from '../shared/types'
import { useGit } from '../hooks/useGit'
import { useFileWatcher } from '../hooks/useFileWatcher'
import { Toolbar } from './Toolbar'
import { FileList } from './FileList'
import { DiffViewer } from './DiffViewer'
import { CommitBox } from './CommitBox'
import { Notification } from './Notification'

export default function App(): React.ReactElement {
  const {
    status,
    branchInfo,
    diff,
    loading,
    diffLoading,
    selectedFile,
    selectedFileStaged,
    refresh,
    selectFile,
    stageFiles,
    unstageFiles,
    commit,
    push,
    pushSetUpstream
  } = useGit()

  const [notification, setNotification] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  useFileWatcher(refresh)

  const showNotification = useCallback(
    (message: string, type: 'success' | 'error') => {
      setNotification({ message, type })
      setTimeout(() => setNotification(null), 4000)
    },
    []
  )

  const handleCommit = useCallback(
    async (summary: string, description?: string) => {
      const result = await commit(summary, description)
      if (result.success) {
        showNotification('Changes committed', 'success')
      } else {
        showNotification(result.error || 'Commit failed', 'error')
      }
    },
    [commit, showNotification]
  )

  const handlePush = useCallback(async () => {
    let result
    if (branchInfo && !branchInfo.hasUpstream) {
      result = await pushSetUpstream()
    } else {
      result = await push()
    }
    if (result.success) {
      showNotification('Pushed successfully', 'success')
    } else {
      showNotification(result.error || 'Push failed', 'error')
    }
  }, [branchInfo, push, pushSetUpstream, showNotification])

  const handleToggleFile = useCallback(
    async (file: FileEntry, isCurrentlyStaged: boolean) => {
      if (isCurrentlyStaged) {
        await unstageFiles([file.path])
      } else {
        await stageFiles([file.path])
      }
    },
    [stageFiles, unstageFiles]
  )

  return (
    <div className="app">
      <Toolbar branchInfo={branchInfo} onPush={handlePush} />
      {notification && (
        <Notification message={notification.message} type={notification.type} />
      )}
      <div className="main-content">
        <div className="sidebar">
          <FileList
            staged={status?.staged || []}
            unstaged={status?.unstaged || []}
            untracked={status?.untracked || []}
            loading={loading}
            selectedFile={selectedFile}
            selectedFileStaged={selectedFileStaged}
            onSelectFile={selectFile}
            onToggleFile={handleToggleFile}
          />
          <CommitBox
            branchName={branchInfo?.name || ''}
            onCommit={handleCommit}
            hasStaged={(status?.staged || []).length > 0}
          />
        </div>
        <div className="diff-panel">
          <DiffViewer
            diff={diff}
            fileName={selectedFile?.path || null}
            loading={diffLoading}
          />
        </div>
      </div>
    </div>
  )
}
