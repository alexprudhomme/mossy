import { useState, useEffect, useCallback } from 'react'
import { FileEntry, GitStatus, BranchInfo, GitResult } from '../types'

export function useGit() {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [selectedFileStaged, setSelectedFileStaged] = useState(false)
  const [diff, setDiff] = useState<string>('')
  const [initialized, setInitialized] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [newStatus, newBranch] = await Promise.all([
        window.gitpeek.git.status(),
        window.gitpeek.git.branchInfo()
      ])
      setStatus(newStatus)
      setBranchInfo(newBranch)
    } catch (err) {
      console.error('Failed to refresh status:', err)
    }
  }, [])

  // Initialize window ID and load initial data
  useEffect(() => {
    async function init() {
      try {
        const id = await window.gitpeek.getWindowId()
        window.gitpeek.setWindowId(id)
        setInitialized(true)
      } catch (err) {
        console.error('Failed to initialize:', err)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (initialized) {
      refresh()
    }
  }, [initialized, refresh])

  // Load diff when selected file changes
  useEffect(() => {
    if (!selectedFile || !initialized) {
      setDiff('')
      return
    }
    async function loadDiff() {
      try {
        const d = await window.gitpeek.git.diff(
          selectedFile!.path,
          selectedFileStaged
        )
        setDiff(d)
      } catch (err) {
        console.error('Failed to load diff:', err)
        setDiff('')
      }
    }
    loadDiff()
  }, [selectedFile, selectedFileStaged, initialized])

  const selectFile = useCallback((file: FileEntry, staged: boolean) => {
    setSelectedFile(file)
    setSelectedFileStaged(staged)
  }, [])

  const stageFiles = useCallback(
    async (filePaths: string[]) => {
      await window.gitpeek.git.stage(filePaths)
      await refresh()
    },
    [refresh]
  )

  const unstageFiles = useCallback(
    async (filePaths: string[]) => {
      await window.gitpeek.git.unstage(filePaths)
      await refresh()
    },
    [refresh]
  )

  const commit = useCallback(
    async (summary: string, description?: string): Promise<GitResult> => {
      const result = await window.gitpeek.git.commit(summary, description)
      if (result.success) {
        setSelectedFile(null)
        setDiff('')
        await refresh()
      }
      return result
    },
    [refresh]
  )

  const push = useCallback(async (): Promise<GitResult> => {
    const result = await window.gitpeek.git.push()
    if (result.success) await refresh()
    return result
  }, [refresh])

  const pushSetUpstream = useCallback(async (): Promise<GitResult> => {
    const result = await window.gitpeek.git.pushSetUpstream()
    if (result.success) await refresh()
    return result
  }, [refresh])

  return {
    status,
    branchInfo,
    diff,
    selectedFile,
    selectedFileStaged,
    refresh,
    selectFile,
    stageFiles,
    unstageFiles,
    commit,
    push,
    pushSetUpstream
  }
}
