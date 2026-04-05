import { useState, useEffect, useCallback } from 'react'
import { IconSettings, IconSearch, IconX, IconTicket } from '@tabler/icons-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { RepoDashboard } from './RepoDashboard'
import { SettingsModal } from './SettingsModal'
import { IssuePanel } from './IssuePanel'
import { useConfig } from '../hooks/useConfig'
import { useMyIssues } from '../hooks/useMyIssues'
import { useIssueDrag } from '../hooks/useIssueDrag'
import { rpc } from '../rpc'
import type { DragEndEvent } from '@dnd-kit/core'
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
    setRepoSetupCommands, setIssuePanelOpen, setIssuePanelWidth,
    setWorktreeBasePath, setIssueTracker, setFetchInterval
  } = useConfig()
  const [settingsOpened, setSettingsOpened] = useState(false)
  const [search, setSearch] = useState('')
  const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null)
  const [dependencyWarningDismissed, setDependencyWarningDismissed] = useState(false)
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
    setIssueDropTargets((prev) => ({ ...prev, [repoId]: `${data.issueKey}-` }))
  }, [])

  const handlePanelResize = useCallback((width: number) => {
    setPanelWidth(width)
    void setIssuePanelWidth(width)
  }, [setIssuePanelWidth])

  const { isDragging: isDraggingIssue, draggingKey, overRepoId, onMouseDown: onIssueMouseDown } =
    useIssueDrag(handleIssueDrop)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedRepos.findIndex((r) => r.id === active.id)
    const newIndex = orderedRepos.findIndex((r) => r.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(orderedRepos, oldIndex, newIndex)
    setOrderedRepos(reordered)
    void reorderRepos(reordered)
  }, [orderedRepos, reorderRepos])

  const loadDependencies = useCallback(async () => {
    try {
      const status = await rpc().request['system:dependencies']({})
      setDependencyStatus(status)
    } catch {
      setDependencyStatus(null)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey) return
      if (e.key === 'q') { e.preventDefault(); rpc().request['app:quit']({}) }
      else if (e.key === 'w') { e.preventDefault(); rpc().request['app:closeWindow']({}) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Settings event from main process menu
  useEffect(() => {
    const handleOpenSettings = () => setSettingsOpened(true)
    window.addEventListener('mossy:open-settings', handleOpenSettings)
    return () => window.removeEventListener('mossy:open-settings', handleOpenSettings)
  }, [])

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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* Header / Title bar */}
        <header className="flex items-center justify-end h-[38px] px-4 border-b border-primary/15 shrink-0 electrobun-webkit-app-region-drag">
          <div className="flex items-center gap-1.5 electrobun-webkit-app-region-no-drag">
            <div className="relative flex items-center">
              <IconSearch size={14} className="absolute left-2 text-[#484f58]" />
              <input
                type="text"
                placeholder="Filter worktrees…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-[220px] bg-transparent border-none text-xs text-foreground placeholder-[#484f58] pl-7 pr-6 py-1 focus:outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-1 p-0.5 rounded-md text-[#484f58] hover:text-foreground transition-colors">
                  <IconX size={12} />
                </button>
              )}
            </div>

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
              {missingDependencies.length > 0 && !dependencyWarningDismissed && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-md px-4 py-3 text-sm relative">
                  <button
                    onClick={() => setDependencyWarningDismissed(true)}
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
                search={search}
                defaultIde={config.defaultIde}
                issueTracker={config.issueTracker}
                onReorder={(repos) => { setOrderedRepos(repos); void reorderRepos(repos) }}
                isDraggingIssue={isDraggingIssue}
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
                draggingKey={draggingKey}
                onIssueMouseDown={onIssueMouseDown}
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
        setRepoSetupCommands={setRepoSetupCommands}
        setWorktreeBasePath={setWorktreeBasePath}
        setIssueTracker={setIssueTracker}
      />
    </DndContext>
  )
}
