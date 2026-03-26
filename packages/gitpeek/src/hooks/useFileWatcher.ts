import { useEffect } from 'react'

export function useFileWatcher(onRefresh: () => void): void {
  useEffect(() => {
    const handler = () => onRefresh()
    window.addEventListener('gitpeek:files-changed', handler)
    return () => window.removeEventListener('gitpeek:files-changed', handler)
  }, [onRefresh])
}
