import { useState, useEffect, useCallback, useRef } from 'react'
import { rpc } from '../rpc'
import type { PRInfo, Worktree } from '../shared/types'

export function useWorktreePRs(
  repoPath: string | null,
  worktrees: Worktree[],
  pollIntervalSec: number,
  refreshKey?: number
) {
  const [prMap, setPRMap] = useState<Map<string, PRInfo | null>>(new Map())
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchingRef = useRef(false)
  const lastFetchKeyRef = useRef<string>('')

  const fetchAll = useCallback(async () => {
    if (!repoPath) {
      setPRMap(new Map())
      return
    }

    const featureWorktrees = worktrees.filter((wt) => !wt.isMain)
    if (featureWorktrees.length === 0) {
      setPRMap(new Map())
      return
    }

    // Create a stable key for this fetch request
    const fetchKey = `${repoPath}:${featureWorktrees.map((wt) => wt.path).sort().join(',')}`
    
    // Skip if already fetching the same set of worktrees
    if (fetchingRef.current && fetchKey === lastFetchKeyRef.current) return
    
    lastFetchKeyRef.current = fetchKey
    fetchingRef.current = true
    setLoading(true)

    try {
      const entries = await Promise.all(
        featureWorktrees.map(async (wt) => {
          try {
            const pr = await rpc().request['gh:pr']({ repoPath, branch: wt.branch })
            return [wt.path, pr] as const
          } catch {
            return [wt.path, null] as const
          }
        })
      )
      setPRMap(new Map(entries))
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [repoPath, worktrees])

  // Fetch on mount, refreshKey change, or polling interval
  useEffect(() => {
    fetchAll()

    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollIntervalSec > 0) {
      intervalRef.current = setInterval(fetchAll, pollIntervalSec * 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [repoPath, pollIntervalSec, refreshKey])

  // Fetch when worktree list changes (new worktree added/removed)
  useEffect(() => {
    fetchAll()
  }, [worktrees.map((wt) => wt.path).join(',')])

  return { prMap, loading, refresh: fetchAll }
}
