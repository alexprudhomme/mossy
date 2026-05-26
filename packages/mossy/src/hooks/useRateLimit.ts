import { useState, useEffect, useCallback, useRef } from 'react'
import { rpc } from '../rpc'
import type { RateLimitStatus } from '../shared/types'

export function useRateLimit(pollIntervalSec: number) {
  const [status, setStatus] = useState<RateLimitStatus>({ limited: false, resetsAt: null })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    try {
      const result = await rpc().request['gh:rateLimit']({})
      setStatus(result)
    } catch {
      // Ignore errors
    }
  }, [])

  useEffect(() => {
    fetch()

    if (intervalRef.current) clearInterval(intervalRef.current)
    if (pollIntervalSec > 0) {
      intervalRef.current = setInterval(fetch, pollIntervalSec * 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetch, pollIntervalSec])

  return { status, refresh: fetch }
}
