import { useState, useEffect, useCallback, useRef } from 'react'
import { rpc } from '../rpc'
import type { GitStatus, BranchInfo, GitResult, FileEntry } from '../shared/types'

export function useWorktreeDiff(worktreePath: string | null) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ path: string; staged: boolean } | null>(null)
  const [diffText, setDiffText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const diffRequestId = useRef(0)
  // Suppress auto-refresh while a stage/unstage/commit is in flight
  const mutatingRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!worktreePath) {
      setGitStatus(null)
      setBranchInfo(null)
      return
    }
    try {
      const [status, branch] = await Promise.all([
        rpc().request['git:status']({ worktreePath }),
        rpc().request['git:branchInfo']({ worktreePath })
      ])
      setGitStatus(status)
      setBranchInfo(branch)
    } catch {
      setGitStatus(null)
      setBranchInfo(null)
    }
  }, [worktreePath])

  // Reset selection when worktree changes
  useEffect(() => {
    setSelectedFile(null)
    setDiffText('')
    diffRequestId.current++
  }, [worktreePath])

  useEffect(() => {
    refresh()
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (worktreePath) {
      intervalRef.current = setInterval(() => {
        if (!mutatingRef.current) refresh()
      }, 2000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh, worktreePath])

  const loadDiff = useCallback(async (filePath: string, staged: boolean) => {
    if (!worktreePath) return
    setSelectedFile({ path: filePath, staged })
    setLoading(true)
    const requestId = ++diffRequestId.current
    try {
      const text = await rpc().request['git:diff']({ worktreePath, filePath, staged })
      // Only update if this is still the latest request (prevents race conditions)
      if (requestId === diffRequestId.current) {
        setDiffText(text)
      }
    } catch {
      if (requestId === diffRequestId.current) {
        setDiffText('')
      }
    } finally {
      if (requestId === diffRequestId.current) {
        setLoading(false)
      }
    }
  }, [worktreePath])

  const stage = useCallback(async (filePaths: string[]) => {
    if (!worktreePath) return
    mutatingRef.current = true
    try {
      await rpc().request['git:stage']({ worktreePath, filePaths })
      await refresh()
    } finally {
      mutatingRef.current = false
    }
  }, [worktreePath, refresh])

  const unstage = useCallback(async (filePaths: string[]) => {
    if (!worktreePath) return
    mutatingRef.current = true
    try {
      await rpc().request['git:unstage']({ worktreePath, filePaths })
      await refresh()
    } finally {
      mutatingRef.current = false
    }
  }, [worktreePath, refresh])

  const commit = useCallback(async (summary: string, description?: string): Promise<GitResult> => {
    if (!worktreePath) return { success: false, error: 'No worktree path' }
    mutatingRef.current = true
    try {
      const result = await rpc().request['git:commit']({ worktreePath, summary, description })
      if (result.success) {
        await refresh()
        setSelectedFile(null)
        setDiffText('')
      }
      return result
    } finally {
      mutatingRef.current = false
    }
  }, [worktreePath, refresh])

  const push = useCallback(async (): Promise<GitResult> => {
    if (!worktreePath) return { success: false, error: 'No worktree path' }
    const result = await rpc().request['git:push']({ worktreePath })
    if (result.success) await refresh()
    return result
  }, [worktreePath, refresh])

  return {
    gitStatus, branchInfo, selectedFile, diffText, loading,
    loadDiff, stage, unstage, commit, push, refresh, setSelectedFile
  }
}
