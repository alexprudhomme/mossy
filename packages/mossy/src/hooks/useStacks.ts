import { useState, useEffect, useCallback, useRef } from 'react'
import { rpc } from '../rpc'
import type { StackInfo } from '../shared/types'

export function useStacks(
  repoPath: string | null,
  pollIntervalSec: number,
  refreshKey?: number
) {
  const [stacks, setStacks] = useState<StackInfo[]>([])
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fetchingRef = useRef(false)

  const fetchStacks = useCallback(async () => {
    if (!repoPath) {
      setStacks([])
      return
    }
    if (fetchingRef.current) return

    fetchingRef.current = true
    setLoading(true)
    try {
      const result = await rpc().request['gh:stacks']({ repoPath })
      setStacks(Array.isArray(result) ? result : [])
    } catch {
      setStacks([])
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [repoPath])

  useEffect(() => {
    fetchStacks()

    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollIntervalSec > 0) {
      intervalRef.current = setInterval(fetchStacks, pollIntervalSec * 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [repoPath, pollIntervalSec, refreshKey])

  return { stacks, loading, refresh: fetchStacks }
}
