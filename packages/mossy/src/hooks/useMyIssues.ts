import { useState, useEffect, useCallback } from 'react'
import { rpc } from '../rpc'
import type { Issue } from '../shared/types'

export function useMyIssues(pollIntervalSec: number) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const result = await rpc().request['issues:mine']({})
      setIssues(result)
    } catch {
      setIssues([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, pollIntervalSec * 1000)
    return () => clearInterval(interval)
  }, [fetch, pollIntervalSec])

  return { issues, loading, refresh: fetch }
}
