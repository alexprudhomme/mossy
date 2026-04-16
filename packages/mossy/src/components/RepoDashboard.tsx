import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  IconRefresh, IconPlus, IconChevronDown, IconChevronRight, IconGripVertical,
  IconAlertCircle, IconCheck, IconX
} from '@tabler/icons-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '../lib/utils'
import { WorktreeCard } from './WorktreeCard'
import { AddWorktreeModal } from './AddWorktreeModal'
import { useWorktrees } from '../hooks/useWorktrees'
import { useCollapsed } from '../hooks/useCollapsed'
import { useHomedir } from '../hooks/useHomedir'
import { useFetchRepo } from '../hooks/useFetchRepo'
import type { DragEndEvent } from '@dnd-kit/core'
import type { IdeId, IssueTracker, RepoConfig, Worktree } from '../shared/types'

// --- RepoSection ---

interface RepoSectionProps {
  repo: RepoConfig
  pollIntervalSec: number
  fetchIntervalSec: number
  defaultIde: IdeId
  issueTracker: IssueTracker
  isCollapsed: boolean
  onToggleCollapse: () => void
  isDropTarget: boolean
  isOver: boolean
  issueDropBranch: string | null
  onIssueDropBranchClear: () => void
  savedWorktreeOrder: string[]
  onReorderWorktrees: (repoId: string, worktreePaths: string[]) => void
}

function RepoSection({
  repo, pollIntervalSec, fetchIntervalSec, defaultIde, issueTracker,
  isCollapsed, onToggleCollapse, isDropTarget, isOver, issueDropBranch, onIssueDropBranchClear,
  savedWorktreeOrder, onReorderWorktrees
}: RepoSectionProps) {
  const { worktrees, loading, error, deleteError, deletingPaths, startDelete, clearDeleteError, settingUpPaths, setupError, startSetup, clearSetupError, refresh } = useWorktrees(repo.path, pollIntervalSec)
  const [addOpened, setAddOpened] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: repo.id })
  const { shortenPath } = useHomedir()

  const handleFetched = useCallback(() => setRefreshKey((k) => k + 1), [])
  useFetchRepo(repo.path, fetchIntervalSec, handleFetched)

  // Derive ordered worktrees: saved order first, then any new ones at end
  const derivedWorktrees = useMemo(() => {
    if (savedWorktreeOrder.length === 0) return worktrees
    const orderMap = new Map(savedWorktreeOrder.map((p, i) => [p, i]))
    const sorted = [...worktrees].sort((a, b) => {
      const ai = orderMap.get(a.path) ?? Number.MAX_SAFE_INTEGER
      const bi = orderMap.get(b.path) ?? Number.MAX_SAFE_INTEGER
      return ai - bi
    })
    return sorted
  }, [worktrees, savedWorktreeOrder])

  // Optimistic local state — prevents snap-back flicker during async config save
  const [orderedWorktrees, setOrderedWorktrees] = useState<Worktree[]>(derivedWorktrees)
  useEffect(() => { setOrderedWorktrees(derivedWorktrees) }, [derivedWorktrees])

  const worktreeSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleWorktreeDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedWorktrees.findIndex((wt) => wt.path === active.id)
    const newIndex = orderedWorktrees.findIndex((wt) => wt.path === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(orderedWorktrees, oldIndex, newIndex)
    setOrderedWorktrees(reordered)
    onReorderWorktrees(repo.id, reordered.map((wt) => wt.path))
  }, [orderedWorktrees, onReorderWorktrees, repo.id])

  useEffect(() => {
    if (issueDropBranch) setAddOpened(true)
  }, [issueDropBranch])

  const handleClose = () => {
    setAddOpened(false)
    onIssueDropBranchClear()
  }

  const handleWorktreeCreated = async (worktreePath: string) => {
    onIssueDropBranchClear()
    await refresh()
    const commands = repo.setupCommands ?? []
    if (commands.length > 0) void startSetup(worktreePath, commands)
  }

  const dropHighlight = isDropTarget && isOver

  if (!loading && worktrees.length === 0) return null

  return (
    <div
      ref={setNodeRef}
      data-repo-id={repo.id}
      className={cn(
        'flex flex-col gap-3 rounded-lg transition-all duration-100',
        isDragging && 'opacity-40'
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? transition ?? undefined : 'border-color 0.1s, background 0.1s',
        border: isDropTarget
          ? dropHighlight ? '1px dashed rgba(0, 136, 255, 0.9)' : '1px dashed rgba(0, 136, 255, 0.35)'
          : '1px solid transparent',
        background: dropHighlight ? 'rgba(0, 136, 255, 0.06)' : undefined,
        padding: isDropTarget ? 8 : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            className="p-0.5 rounded-md text-[#484f58] hover:text-muted-foreground cursor-grab touch-none transition-colors"
            {...attributes}
            {...listeners}
          >
            <IconGripVertical size={14} />
          </button>
          <button className="p-0.5 rounded-md text-[#484f58] hover:text-muted-foreground transition-colors" onClick={onToggleCollapse}>
            {isCollapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
          </button>
          <span className="text-base font-semibold font-mono text-foreground cursor-pointer" onClick={onToggleCollapse}>
            {repo.name}
          </span>
          <span className="text-xs text-[#484f58]">{shortenPath(repo.path)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors" onClick={() => setAddOpened(true)}>
            <IconPlus size={16} />
          </button>
          <button
            className="p-1 rounded-md text-primary hover:bg-primary/10 transition-colors"
            onClick={() => { refresh(); setRefreshKey((k) => k + 1) }}
          >
            {loading ? (
              <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full inline-block" />
            ) : (
              <IconRefresh size={16} />
            )}
          </button>
        </div>
      </div>

      <AddWorktreeModal
        repo={repo}
        opened={addOpened}
        onClose={handleClose}
        onCreated={handleWorktreeCreated}
        initialBranch={issueDropBranch ?? undefined}
      />

      {!isCollapsed && (
        <div className="flex flex-col gap-3">
          {error && (
            <div className="bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-md px-3 py-2 text-sm">{error}</div>
          )}
          {deleteError && (
            <div className="bg-pink-500/10 border border-pink-500/30 text-pink-400 rounded-md px-3 py-2 text-sm flex items-start gap-2">
              <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{deleteError}</span>
              <button onClick={clearDeleteError} className="text-pink-400 hover:text-pink-300"><IconX size={14} /></button>
            </div>
          )}
          {setupError && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded-md px-3 py-2 text-sm">
              <div className="font-medium mb-1">Setup failed for {setupError.worktreeName}</div>
              {setupError.results.map((result, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs">
                  {result.success ? <IconCheck size={12} className="text-emerald-400" /> : <IconX size={12} className="text-pink-400" />}
                  <code className="bg-muted px-1 py-0.5 rounded">{result.command}</code>
                  {!result.success && result.output && (
                    <pre className="mt-1 text-[10px] bg-background rounded p-1 max-h-20 overflow-auto">{result.output}</pre>
                  )}
                </div>
              ))}
              <button onClick={clearSetupError} className="text-xs mt-1 text-yellow-400 hover:underline">Dismiss</button>
            </div>
          )}
          {loading && worktrees.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Loading worktrees...</span>
            </div>
          ) : (
            <DndContext sensors={worktreeSensors} collisionDetection={closestCenter} onDragEnd={handleWorktreeDragEnd}>
              <SortableContext items={orderedWorktrees.map((wt) => wt.path)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {orderedWorktrees.map((wt) => (
                    <WorktreeCard
                      key={wt.path}
                      worktree={wt}
                      repoPath={repo.path}
                      pollIntervalSec={pollIntervalSec}
                      refreshKey={refreshKey}
                      defaultIde={defaultIde}
                      issueTracker={issueTracker}
                      deleting={deletingPaths.has(wt.path)}
                      settingUp={settingUpPaths.has(wt.path)}
                      onConfirmDelete={(force) => startDelete(wt.path, force)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  )
}

// --- RepoDashboard ---

interface RepoDashboardProps {
  repos: RepoConfig[]
  pollIntervalSec: number
  fetchIntervalSec: number
  defaultIde: IdeId
  issueTracker: IssueTracker
  worktreeOrder: Record<string, string[]>
  onReorder: (repos: RepoConfig[]) => void
  onReorderWorktrees: (repoId: string, worktreePaths: string[]) => void
  isDraggingIssue: boolean
  overRepoId: string | null
  issueDropTargets: Record<string, string | null>
  onIssueDropBranchClear: (repoId: string) => void
}

export function RepoDashboard({
  repos, pollIntervalSec, fetchIntervalSec, defaultIde, issueTracker,
  worktreeOrder, onReorder, onReorderWorktrees, isDraggingIssue, overRepoId, issueDropTargets, onIssueDropBranchClear
}: RepoDashboardProps) {
  const { collapsed, toggle } = useCollapsed()
  const [orderedRepos, setOrderedRepos] = useState(repos)

  useEffect(() => { setOrderedRepos(repos) }, [repos])

  if (orderedRepos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <p className="text-lg text-muted-foreground">No repositories configured</p>
        <p className="text-sm text-[#484f58]">Open Settings to add your Git repositories.</p>
      </div>
    )
  }

  return (
    <SortableContext items={orderedRepos.map((r) => r.id)} strategy={verticalListSortingStrategy}>
      <div className="flex flex-col gap-6">
        {orderedRepos.map((repo) => (
          <RepoSection
            key={repo.id}
            repo={repo}
            pollIntervalSec={pollIntervalSec}
            fetchIntervalSec={fetchIntervalSec}
            defaultIde={defaultIde}
            issueTracker={issueTracker}
            isCollapsed={collapsed.has(repo.id)}
            onToggleCollapse={() => toggle(repo.id)}
            isDropTarget={isDraggingIssue}
            isOver={overRepoId === repo.id}
            issueDropBranch={issueDropTargets[repo.id] ?? null}
            onIssueDropBranchClear={() => onIssueDropBranchClear(repo.id)}
            savedWorktreeOrder={worktreeOrder[repo.id] ?? []}
            onReorderWorktrees={onReorderWorktrees}
          />
        ))}
      </div>
    </SortableContext>
  )
}
