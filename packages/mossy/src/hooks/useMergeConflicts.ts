import { useState, useEffect, useCallback, useRef } from 'react'
import { rpc } from '../rpc'
import type { MergeConflictInfo } from '../shared/types'

export function useMergeConflicts(
  worktreePath: string,
  repoPath: string,
  isMain: boolean,
  pollIntervalSec: number,
  refreshKey?: number
) {
  const [conflicts, setConflicts] = useState<MergeConflictInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    // No point checking conflicts for the main branch
    if (isMain) {
      setConflicts(null)
      return
    }
    setLoading(true)
    try {
      const result = await rpc().request['git:mergeConflicts']({ worktreePath, repoPath })
      setConflicts(result)
    } catch {
      setConflicts(null)
    } finally {
      setLoading(false)
    }
  }, [worktreePath, repoPath, isMain, refreshKey])

  useEffect(() => {
    fetch()

    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollIntervalSec > 0 && !isMain) {
      intervalRef.current = setInterval(fetch, pollIntervalSec * 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetch, pollIntervalSec, isMain])

  return { conflicts, loading, refresh: fetch }
}
