import { useState, useEffect, useRef, useCallback } from 'react'

export interface IssueDragData {
  issueKey: string
  issueSummary: string
}

interface IssueDragState {
  data: IssueDragData
  x: number
  y: number
}

interface UseIssueDragResult {
  isDragging: boolean
  draggingKey: string | null
  overRepoId: string | null
  onMouseDown: (e: React.MouseEvent, data: IssueDragData) => void
}

function repoIdAtPoint(x: number, y: number): string | null {
  const els = document.elementsFromPoint(x, y)
  for (const el of els) {
    const id = (el as HTMLElement).dataset?.repoId
    if (id) return id
  }
  return null
}

export function useIssueDrag(
  onDrop: (repoId: string, data: IssueDragData) => void
): UseIssueDragResult {
  const [drag, setDrag] = useState<IssueDragState | null>(null)
  const [overRepoId, setOverRepoId] = useState<string | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)

  const onMouseDown = useCallback((e: React.MouseEvent, data: IssueDragData) => {
    const startX = e.clientX
    const startY = e.clientY

    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX
      const dy = me.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) >= 6) {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setDrag({ data, x: me.clientX, y: me.clientY })
        setOverRepoId(null)
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  useEffect(() => {
    if (!drag) return

    const ghost = document.createElement('div')
    ghost.style.cssText = `
      position: fixed;
      left: ${drag.x + 12}px;
      top: ${drag.y - 16}px;
      padding: 5px 10px;
      border-radius: 6px;
      background: #161b22;
      border: 1px solid rgba(88, 166, 255, 0.5);
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      font-size: 12px;
      font-family: monospace;
      color: #e6edf3;
      pointer-events: none;
      z-index: 9999;
      white-space: nowrap;
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
    `
    const summary = drag.data.issueSummary.length > 40
      ? drag.data.issueSummary.slice(0, 40) + '…'
      : drag.data.issueSummary
    ghost.textContent = `${drag.data.issueKey} — ${summary}`
    document.body.appendChild(ghost)
    ghostRef.current = ghost

    const handleMouseMove = (e: MouseEvent) => {
      ghost.style.left = `${e.clientX + 12}px`
      ghost.style.top = `${e.clientY - 16}px`

      const repoId = repoIdAtPoint(e.clientX, e.clientY)
      setOverRepoId(repoId)

      if (repoId) {
        ghost.style.borderColor = 'rgba(88, 166, 255, 0.9)'
        ghost.style.background = 'rgba(0,50,120,0.95)'
      } else {
        ghost.style.borderColor = 'rgba(88, 166, 255, 0.5)'
        ghost.style.background = '#161b22'
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      const repoId = repoIdAtPoint(e.clientX, e.clientY)
      if (repoId && drag) {
        onDrop(repoId, drag.data)
      }
      cleanup()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup()
    }

    const cleanup = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
      if (ghostRef.current) {
        document.body.removeChild(ghostRef.current)
        ghostRef.current = null
      }
      setDrag(null)
      setOverRepoId(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)

    return cleanup
  }, [drag, onDrop])

  return {
    isDragging: drag !== null,
    draggingKey: drag?.data.issueKey ?? null,
    overRepoId,
    onMouseDown
  }
}
