import { useState, useEffect, useCallback } from 'react'
import { IconSettings, IconTicket } from '@tabler/icons-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { RepoDashboard } from './RepoDashboard'
import { SettingsModal } from './SettingsModal'
import { IssuePanel } from './IssuePanel'
import { IssueCardOverlay } from './IssueCard'
import { useConfig } from '../hooks/useConfig'
import { useMyIssues } from '../hooks/useMyIssues'
import { isIssueDragId, isRepoDropId, extractRepoIdFromDropId, ISSUE_DRAG_PREFIX } from '../hooks/useIssueDrag'
import { rpc } from '../rpc'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import type { DependencyStatus, RepoConfig } from '../shared/types'
import type { IssueDragData } from '../hooks/useIssueDrag'

const INSTALL_URLS: Record<string, string> = {
  gh: 'https://cli.github.com/',
  jira: 'https://github.com/ankitpokhrel/jira-cli'
}

export default function App() {
  const {
    config, loading,
    addRepo, removeRepo, setPollInterval, setAutoUpdateEnabled,
    setUpdateCheckInterval, reorderRepos, setDefaultIde,
    setDefaultTerminal, setRepoSetupCommands, setIssuePanelOpen, setIssuePanelWidth,
    setWorktreeBasePath, setIssueTracker, setFetchInterval,
    setDismissedDependencyWarning, setZoomLevel, toggleNotReady
  } = useConfig()
  const [settingsOpened, setSettingsOpened] = useState(false)
  const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null)
  const [issueDropTargets, setIssueDropTargets] = useState<Record<string, string | null>>({})
  const [orderedRepos, setOrderedRepos] = useState<RepoConfig[]>([])
  const [panelWidth, setPanelWidth] = useState<number>(260)

  const issuePanelOpen = config?.issuePanelOpen ?? false
  const issueTracker = config?.issueTracker ?? 'none'
  const pollIntervalSec = config?.pollIntervalSec ?? 60

  useEffect(() => {
    if (config) setPanelWidth(config.issuePanelWidth ?? 260)
  }, [config?.issuePanelWidth])

  const { issues, loading: issuesLoading, refresh: refreshIssues } = useMyIssues(pollIntervalSec)

  useEffect(() => {
    if (config) setOrderedRepos(config.repositories)
  }, [config])

  const handleIssueDrop = useCallback((repoId: string, data: IssueDragData) => {
    const branchPrefix = data.issueKey.replace(/#/g, '')
    setIssueDropTargets((prev) => ({ ...prev, [repoId]: `${branchPrefix}-` }))
  }, [])

  const handlePanelResize = useCallback((width: number) => {
    setPanelWidth(width)
    void setIssuePanelWidth(width)
  }, [setIssuePanelWidth])

  // Unified dnd-kit state for issue dragging
  const [draggingIssueKey, setDraggingIssueKey] = useState<string | null>(null)
  const [isDraggingRepo, setIsDraggingRepo] = useState(false)
  const [overRepoId, setOverRepoId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id)
    if (isIssueDragId(id)) {
      setDraggingIssueKey(id.slice(ISSUE_DRAG_PREFIX.length))
    } else {
      setIsDraggingRepo(true)
    }
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id ? String(event.over.id) : null
    if (overId && isRepoDropId(overId)) {
      setOverRepoId(extractRepoIdFromDropId(overId))
    } else if (overId && orderedRepos.some((r) => r.id === overId)) {
      // Collision detection may resolve to the sortable repo ID
      setOverRepoId(overId)
    } else {
      setOverRepoId(null)
    }
  }, [orderedRepos])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const activeId = String(event.active.id)

    // Issue dropped onto a repo
    if (isIssueDragId(activeId)) {
      const overId = event.over?.id ? String(event.over.id) : null
      let targetRepoId: string | null = null
      if (overId && isRepoDropId(overId)) {
        targetRepoId = extractRepoIdFromDropId(overId)
      } else if (overId && orderedRepos.some((r) => r.id === overId)) {
        targetRepoId = overId
      }
      if (targetRepoId) {
        const data = event.active.data.current as IssueDragData
        handleIssueDrop(targetRepoId, data)
      }
      setDraggingIssueKey(null)
      setOverRepoId(null)
      return
    }

    // Repo reordering
    const { active, over } = event
    if (!over || active.id === over.id) { setIsDraggingRepo(false); return }
    const oldIndex = orderedRepos.findIndex((r) => r.id === active.id)
    const newIndex = orderedRepos.findIndex((r) => r.id === over.id)
    if (oldIndex === -1 || newIndex === -1) { setIsDraggingRepo(false); return }
    const reordered = arrayMove(orderedRepos, oldIndex, newIndex)
    setOrderedRepos(reordered)
    void reorderRepos(reordered)
    setIsDraggingRepo(false)
  }, [orderedRepos, reorderRepos, handleIssueDrop])

  const handleDragCancel = useCallback(() => {
    setDraggingIssueKey(null)
    setIsDraggingRepo(false)
    setOverRepoId(null)
  }, [])

  // Find the issue being dragged for the overlay
  const draggingIssue = draggingIssueKey ? issues.find((i) => i.key === draggingIssueKey) : null

  const loadDependencies = useCallback(async () => {
    try {
      const status = await rpc().request['system:dependencies']({})
      setDependencyStatus(status)
    } catch {
      setDependencyStatus(null)
    }
  }, [])

  // Apply zoom level to root element
  useEffect(() => {
    if (!config) return
    const zoom = config.zoomLevel ?? 1
    document.documentElement.style.zoom = String(zoom)
  }, [config?.zoomLevel])

  // Zoom helpers
  const zoomIn = useCallback(() => {
    if (!config) return
    const next = Math.round(((config.zoomLevel ?? 1) + 0.1) * 10) / 10
    void setZoomLevel(Math.min(next, 2.0))
  }, [config, setZoomLevel])

  const zoomOut = useCallback(() => {
    if (!config) return
    const next = Math.round(((config.zoomLevel ?? 1) - 0.1) * 10) / 10
    void setZoomLevel(Math.max(next, 0.5))
  }, [config, setZoomLevel])

  const zoomReset = useCallback(() => {
    void setZoomLevel(1)
  }, [setZoomLevel])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey) return
      if (e.key === 'q') { e.preventDefault(); rpc().request['app:quit']({}) }
      else if (e.key === 'w') { e.preventDefault(); rpc().request['app:closeWindow']({}) }
      else if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn() }
      else if (e.key === '-') { e.preventDefault(); zoomOut() }
      else if (e.key === '0') { e.preventDefault(); zoomReset() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomIn, zoomOut, zoomReset])

  // Settings event from main process menu
  useEffect(() => {
    const handleOpenSettings = () => setSettingsOpened(true)
    const handleZoomIn = () => zoomIn()
    const handleZoomOut = () => zoomOut()
    const handleZoomReset = () => zoomReset()
    window.addEventListener('mossy:open-settings', handleOpenSettings)
    window.addEventListener('mossy:zoom-in', handleZoomIn)
    window.addEventListener('mossy:zoom-out', handleZoomOut)
    window.addEventListener('mossy:zoom-reset', handleZoomReset)
    return () => {
      window.removeEventListener('mossy:open-settings', handleOpenSettings)
      window.removeEventListener('mossy:zoom-in', handleZoomIn)
      window.removeEventListener('mossy:zoom-out', handleZoomOut)
      window.removeEventListener('mossy:zoom-reset', handleZoomReset)
    }
  }, [zoomIn, zoomOut, zoomReset])

  useEffect(() => { loadDependencies() }, [loadDependencies])

  const missingDependencies = dependencyStatus
    ? dependencyStatus.checks.filter((c) => c.required && !c.installed)
    : []

  const unauthenticatedDependencies = dependencyStatus
    ? dependencyStatus.checks.filter((c) => c.required && c.installed && c.authenticated === false)
    : []

  if (loading || !config) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <span className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        <span className="text-sm text-muted-foreground mt-3">Loading…</span>
      </div>
    )
  }

  const showIssuePanel = issuePanelOpen && issueTracker !== 'none'

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Header / Title bar */}
        <header
          className="flex items-center justify-end h-[38px] px-4 border-b border-primary/15 shrink-0 select-none electrobun-webkit-app-region-drag"
          onDoubleClick={() => {
            rpc().request['app:toggleZoom']({})
          }}
        >
          <div className="flex items-center gap-1.5 electrobun-webkit-app-region-no-drag">
            {issueTracker !== 'none' && (
              <button
                onClick={() => setIssuePanelOpen(!issuePanelOpen)}
                title={issuePanelOpen ? 'Hide issues' : 'Show issues'}
                className={`p-1.5 rounded-md transition-colors ${issuePanelOpen ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-primary/10'}`}
              >
                <IconTicket size={16} />
              </button>
            )}

            <button
              onClick={() => setSettingsOpened(true)}
              title="Settings"
              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <IconSettings size={16} />
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 overflow-auto p-4">
            <div className="flex flex-col gap-4">
              {missingDependencies.length > 0 && !config.dismissedDependencyWarning && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-md px-4 py-3 text-sm relative">
                  <button
                    onClick={() => setDismissedDependencyWarning(true)}
                    className="absolute top-2 right-2 text-yellow-400/60 hover:text-yellow-400 leading-none"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                  <div className="font-medium mb-1">Missing CLI dependencies</div>
                  {missingDependencies.map((check) => (
                    <div key={check.name} className="text-xs">
                      {check.name === 'gh' ? 'gh CLI missing (PR badges unavailable)' : check.name === 'jira' ? 'jira CLI missing (Jira badges unavailable)' : `${check.name} missing`}
                      {INSTALL_URLS[check.name] && (
                        <> — <a href={INSTALL_URLS[check.name]} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-300">{INSTALL_URLS[check.name]}</a></>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {unauthenticatedDependencies.length > 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-md px-4 py-3 text-sm">
                  <div className="font-medium">CLI authentication required</div>
                  <div className="text-xs">
                    {unauthenticatedDependencies.map((c) =>
                      c.name === 'gh' ? 'gh CLI not authenticated' : c.name === 'jira' ? 'jira CLI not authenticated' : `${c.name} not authenticated`
                    ).join(' | ')}
                  </div>
                </div>
              )}
              <RepoDashboard
                repos={orderedRepos}
                pollIntervalSec={config.pollIntervalSec}
                fetchIntervalSec={config.fetchIntervalSec}
                defaultIde={config.defaultIde}
                defaultTerminal={config.defaultTerminal}
                issueTracker={config.issueTracker}
                notReadyWorktrees={config.notReadyWorktrees}
                onToggleNotReady={toggleNotReady}
                onReorder={(repos) => { setOrderedRepos(repos); void reorderRepos(repos) }}
                isDraggingIssue={draggingIssueKey !== null || isDraggingRepo}
                overRepoId={overRepoId}
                issueDropTargets={issueDropTargets}
                onIssueDropBranchClear={(repoId) => setIssueDropTargets((prev) => ({ ...prev, [repoId]: null }))}
              />
            </div>
          </main>

          {showIssuePanel && (
            <aside className="border-l border-primary/15 shrink-0" style={{ width: panelWidth }}>
              <IssuePanel
                issues={issues}
                loading={issuesLoading}
                onRefresh={refreshIssues}
                onResize={handlePanelResize}
                issueTracker={issueTracker}
              />
            </aside>
          )}
        </div>
      </div>

      <SettingsModal
        opened={settingsOpened}
        onClose={() => setSettingsOpened(false)}
        config={config}
        onDependencyStatusChange={setDependencyStatus}
        addRepo={addRepo}
        removeRepo={removeRepo}
        setPollInterval={setPollInterval}
        setFetchInterval={setFetchInterval}
        setAutoUpdateEnabled={setAutoUpdateEnabled}
        setUpdateCheckInterval={setUpdateCheckInterval}
        setDefaultIde={setDefaultIde}
        setDefaultTerminal={setDefaultTerminal}
        setRepoSetupCommands={setRepoSetupCommands}
        setWorktreeBasePath={setWorktreeBasePath}
        setIssueTracker={setIssueTracker}
      />

      <DragOverlay dropAnimation={null}>
        {draggingIssue ? <IssueCardOverlay issue={draggingIssue} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
