import { useState, useEffect, useCallback } from 'react'
import { rpc } from '../rpc'
import type { FileEntry, GitStatus, BranchInfo, GitResult } from '../shared/types'

export function useGit() {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [selectedFileStaged, setSelectedFileStaged] = useState(false)
  const [diff, setDiff] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [diffLoading, setDiffLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [newStatus, newBranch] = await Promise.all([
        rpc().request['git:status']({}),
        rpc().request['git:branchInfo']({})
      ])
      setStatus(newStatus)
      setBranchInfo(newBranch)
    } catch (err) {
      console.error('Failed to refresh status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  // Load diff when selected file changes
  useEffect(() => {
    if (!selectedFile) {
      setDiff('')
      return
    }
    async function loadDiff() {
      setDiffLoading(true)
      try {
        const d = await rpc().request['git:diff']({
          filePath: selectedFile!.path,
          staged: selectedFileStaged
        })
        setDiff(d)
      } catch (err) {
        console.error('Failed to load diff:', err)
        setDiff('')
      } finally {
        setDiffLoading(false)
      }
    }
    loadDiff()
  }, [selectedFile, selectedFileStaged])

  const selectFile = useCallback((file: FileEntry, staged: boolean) => {
    setSelectedFile(file)
    setSelectedFileStaged(staged)
  }, [])

  const stageFiles = useCallback(
    async (filePaths: string[]) => {
      await rpc().request['git:stage']({ filePaths })
      await refresh()
    },
    [refresh]
  )

  const unstageFiles = useCallback(
    async (filePaths: string[]) => {
      await rpc().request['git:unstage']({ filePaths })
      await refresh()
    },
    [refresh]
  )

  const commit = useCallback(
    async (summary: string, description?: string): Promise<GitResult> => {
      const result = await rpc().request['git:commit']({ summary, description })
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
    const result = await rpc().request['git:push']({})
    if (result.success) await refresh()
    return result
  }, [refresh])

  const pushSetUpstream = useCallback(async (): Promise<GitResult> => {
    const result = await rpc().request['git:pushSetUpstream']({})
    if (result.success) await refresh()
    return result
  }, [refresh])

  return {
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
  }
}
