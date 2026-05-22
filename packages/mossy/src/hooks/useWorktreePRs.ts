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

  const fetchAll = useCallback(async () => {
    if (!repoPath || worktrees.length === 0) {
      setPRMap(new Map())
      return
    }
    setLoading(true)
    try {
      const entries = await Promise.all(
        worktrees
          .filter((wt) => !wt.isMain)
          .map(async (wt) => {
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
    }
  }, [repoPath, worktrees, refreshKey])

  useEffect(() => {
    fetchAll()

    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollIntervalSec > 0) {
      intervalRef.current = setInterval(fetchAll, pollIntervalSec * 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchAll, pollIntervalSec])

  return { prMap, loading, refresh: fetchAll }
}
