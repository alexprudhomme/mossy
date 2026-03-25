import { useEffect } from 'react'

export function useFileWatcher(onRefresh: () => void): void {
  useEffect(() => {
    const cleanup = window.gitpeek.onFilesChanged(() => {
      onRefresh()
    })
    return cleanup
  }, [onRefresh])
}
