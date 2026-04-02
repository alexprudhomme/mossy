import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { cn } from '../lib/utils'
import { useWorktreeDiff } from '../hooks/useWorktreeDiff'
import { parseDiff, type DiffLine } from '../lib/diff-parser'
import type { FileEntry } from '../shared/types'

// ─── Status helpers ──────────────────────────────────────────────────────────

const STATUS_LETTER: Record<FileEntry['status'], string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: 'U',
}

const STATUS_COLOR: Record<FileEntry['status'], string> = {
  modified: 'text-yellow-400',
  added: 'text-emerald-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
  untracked: 'text-muted-foreground',
}

// ─── Notification ────────────────────────────────────────────────────────────

interface Toast {
  message: string
  type: 'success' | 'error'
}

function Notification({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    setFading(false)
    const fadeTimer = setTimeout(() => setFading(true), 800)
    const removeTimer = setTimeout(onDismiss, 1100)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [toast, onDismiss])

  return (
    <div
      className={cn(
        'absolute top-2 right-2 z-50 flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs shadow-lg pointer-events-none',
        'border-border bg-card text-foreground',
        'transition-opacity duration-300',
        fading ? 'opacity-0' : 'opacity-100',
      )}
    >
      <span className={toast.type === 'success' ? 'text-emerald-400' : 'text-red-400'}>
        {toast.type === 'success' ? '✓' : '✕'}
      </span>
      {toast.message}
    </div>
  )
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function Toolbar({
  branchInfo,
  onPush,
}: {
  branchInfo: { name: string; ahead: number; behind: number; hasUpstream: boolean } | null
  onPush: () => void
}) {
  const showPush = branchInfo && (branchInfo.ahead > 0 || !branchInfo.hasUpstream)

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.75 2.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0V4.56L7.78 7.78a.75.75 0 0 1-1.06-1.06L9.94 3.5H8.25a.75.75 0 0 1 0-1.5h3.5ZM4 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 5.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7ZM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 5.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
        </svg>
        <span className="font-medium text-foreground">{branchInfo?.name ?? '…'}</span>
        {branchInfo?.hasUpstream && (branchInfo.ahead > 0 || branchInfo.behind > 0) && (
          <span className="text-muted-foreground">
            {branchInfo.ahead > 0 && <span>↑{branchInfo.ahead}</span>}
            {branchInfo.behind > 0 && <span className="ml-1">↓{branchInfo.behind}</span>}
          </span>
        )}
      </div>
      {showPush && (
        <button
          onClick={onPush}
          className="rounded-md bg-success px-2.5 py-1 text-xs font-medium text-success-foreground hover:bg-success/90 transition-colors"
        >
          {branchInfo.hasUpstream ? 'Push' : 'Publish Branch'}
        </button>
      )}
    </div>
  )
}

// ─── File List Item ──────────────────────────────────────────────────────────

function FileItem({
  file,
  isStaged,
  isSelected,
  onSelect,
  onToggleStage,
}: {
  file: FileEntry
  isStaged: boolean
  isSelected: boolean
  onSelect: () => void
  onToggleStage: () => void
}) {
  const fileName = file.path.split('/').pop() || file.path
  const dir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''

  return (
    <div
      className={cn(
        'group flex items-center gap-1.5 px-2 py-0.5 text-xs cursor-pointer rounded-sm',
        isSelected ? 'bg-[#1f6feb33]' : 'hover:bg-accent',
      )}
      onClick={onSelect}
    >
      <input
        type="checkbox"
        checked={isStaged}
        onChange={(e) => {
          e.stopPropagation()
          onToggleStage()
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-3 w-3 rounded border-border bg-transparent accent-primary cursor-pointer"
      />
      <span className="flex-1 truncate text-foreground" title={file.path}>
        {fileName}
        {dir && <span className="ml-1 text-[#484f58]">{dir}</span>}
      </span>
      <span className={cn('w-3 text-center font-mono text-[10px] flex-shrink-0', STATUS_COLOR[file.status])}>
        {STATUS_LETTER[file.status]}
      </span>
    </div>
  )
}

// ─── File List ───────────────────────────────────────────────────────────────

function FileList({
  staged,
  unstaged,
  untracked,
  selectedFile,
  onSelectFile,
  onStage,
  onUnstage,
}: {
  staged: FileEntry[]
  unstaged: FileEntry[]
  untracked: FileEntry[]
  selectedFile: { path: string; staged: boolean } | null
  onSelectFile: (path: string, isStaged: boolean) => void
  onStage: (paths: string[]) => void
  onUnstage: (paths: string[]) => void
}) {
  const changes = [...unstaged, ...untracked]

  return (
    <div className="flex h-full w-[220px] min-w-[220px] flex-col border-r border-border overflow-y-auto">
      {/* Staged section */}
      <div className="px-2 pt-2 pb-1">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Staged Changes</span>
          <span className="text-[#484f58]">{staged.length}</span>
        </div>
      </div>
      {staged.length === 0 ? (
        <div className="px-3 py-1 text-[10px] text-[#484f58] italic">No staged files</div>
      ) : (
        staged.map((f) => (
          <FileItem
            key={`staged-${f.path}`}
            file={f}
            isStaged
            isSelected={selectedFile?.path === f.path && selectedFile?.staged === true}
            onSelect={() => onSelectFile(f.path, true)}
            onToggleStage={() => onUnstage([f.path])}
          />
        ))
      )}

      {/* Changes section */}
      <div className="mt-2 px-2 pb-1">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Changes</span>
          <span className="text-[#484f58]">{changes.length}</span>
        </div>
      </div>
      {changes.length === 0 ? (
        <div className="px-3 py-1 text-[10px] text-[#484f58] italic">No changes</div>
      ) : (
        changes.map((f) => (
          <FileItem
            key={`change-${f.path}`}
            file={f}
            isStaged={false}
            isSelected={selectedFile?.path === f.path && selectedFile?.staged === false}
            onSelect={() => onSelectFile(f.path, false)}
            onToggleStage={() => onStage([f.path])}
          />
        ))
      )}
    </div>
  )
}

// ─── Diff Viewer ─────────────────────────────────────────────────────────────

function DiffViewer({ diffText, loading }: { diffText: string; loading: boolean }) {
  const parsed = useMemo(() => (diffText ? parseDiff(diffText) : null), [diffText])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-[#484f58]">
        Loading diff…
      </div>
    )
  }

  if (!parsed || parsed.hunks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-[#484f58]">
        {parsed?.isBinary
          ? 'Binary file — cannot display diff'
          : 'Select a file to view changes'}
      </div>
    )
  }

  const additions = parsed.hunks.reduce(
    (n, h) => n + h.lines.filter((l) => l.type === 'added').length,
    0,
  )
  const deletions = parsed.hunks.reduce(
    (n, h) => n + h.lines.filter((l) => l.type === 'removed').length,
    0,
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5 text-[10px] text-muted-foreground">
        {parsed.isNewFile && <span className="text-emerald-400">New file</span>}
        {parsed.isDeletedFile && <span className="text-red-400">Deleted file</span>}
        {additions > 0 && <span className="text-emerald-400">+{additions}</span>}
        {deletions > 0 && <span className="text-red-400">−{deletions}</span>}
      </div>

      {/* Diff lines */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        <table className="w-full border-collapse">
          <tbody>
            {parsed.hunks.map((hunk, hi) =>
              hunk.lines.map((line, li) => (
                <DiffRow key={`${hi}-${li}`} line={line} />
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.type === 'hunk-header') {
    return (
      <tr className="bg-[var(--diff-hunk-bg)]">
        <td className="w-[1px] select-none border-r border-border px-1 text-right text-[#484f58]" />
        <td className="w-[1px] select-none border-r border-border px-1 text-right text-[#484f58]" />
        <td className="px-3 py-0.5 text-[#484f58] italic">
          {line.content || '···'}
        </td>
      </tr>
    )
  }

  const rowBg =
    line.type === 'added'
      ? 'bg-[var(--diff-added-bg)]'
      : line.type === 'removed'
        ? 'bg-[var(--diff-removed-bg)]'
        : ''

  const gutterColor =
    line.type === 'added'
      ? 'text-[var(--diff-added-text)] opacity-60'
      : line.type === 'removed'
        ? 'text-[var(--diff-removed-text)] opacity-60'
        : 'text-[#484f58]'

  const prefix =
    line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '

  return (
    <tr className={rowBg}>
      <td
        className={cn(
          'w-[1px] select-none border-r border-border px-1 text-right',
          gutterColor,
        )}
      >
        {line.oldLineNumber ?? ''}
      </td>
      <td
        className={cn(
          'w-[1px] select-none border-r border-border px-1 text-right',
          gutterColor,
        )}
      >
        {line.newLineNumber ?? ''}
      </td>
      <td className="whitespace-pre-wrap break-all px-1">
        <span className={cn('select-none', gutterColor)}>{prefix}</span>
        <span className="text-foreground">{line.content}</span>
      </td>
    </tr>
  )
}

// ─── Commit Box ──────────────────────────────────────────────────────────────

function CommitBox({
  branchName,
  hasStaged,
  onCommit,
}: {
  branchName: string
  hasStaged: boolean
  onCommit: (summary: string, description?: string) => void
}) {
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const summaryRef = useRef<HTMLInputElement>(null)

  const canCommit = hasStaged && summary.trim().length > 0

  const handleCommit = useCallback(() => {
    if (!canCommit) return
    onCommit(summary.trim(), description.trim() || undefined)
    setSummary('')
    setDescription('')
  }, [canCommit, summary, description, onCommit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleCommit()
      }
    },
    [handleCommit],
  )

  return (
    <div
      className="flex flex-col gap-2 border-t border-border bg-card px-3 py-2.5"
      onKeyDown={handleKeyDown}
    >
      <input
        ref={summaryRef}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Summary (required)"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder-[#484f58] outline-none focus:border-ring"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder-[#484f58] outline-none focus:border-ring"
      />
      <button
        onClick={handleCommit}
        disabled={!canCommit}
        className={cn(
          'w-full rounded-md px-3 py-1 text-xs font-medium transition-colors',
          canCommit
            ? 'bg-success text-success-foreground hover:bg-success/90 cursor-pointer'
            : 'bg-muted text-[#484f58] cursor-not-allowed',
        )}
      >
        Commit to {branchName}
      </button>
    </div>
  )
}

// ─── DiffPanel (main export) ─────────────────────────────────────────────────

interface DiffPanelProps {
  worktreePath: string | null
  className?: string
}

export function DiffPanel({ worktreePath, className }: DiffPanelProps) {
  const {
    gitStatus,
    branchInfo,
    selectedFile,
    diffText,
    loading,
    loadDiff,
    stage,
    unstage,
    commit,
    push,
  } = useWorktreeDiff(worktreePath)

  const [toast, setToast] = useState<Toast | null>(null)

  const showToast = useCallback((message: string, type: Toast['type']) => {
    setToast({ message, type })
  }, [])

  const handlePush = useCallback(async () => {
    const result = await push()
    showToast(
      result.success ? 'Pushed successfully' : result.error || 'Push failed',
      result.success ? 'success' : 'error',
    )
  }, [push, showToast])

  const handleCommit = useCallback(
    async (summary: string, description?: string) => {
      const result = await commit(summary, description)
      showToast(
        result.success ? 'Changes committed' : result.error || 'Commit failed',
        result.success ? 'success' : 'error',
      )
    },
    [commit, showToast],
  )

  const handleSelectFile = useCallback(
    (path: string, isStaged: boolean) => {
      loadDiff(path, isStaged)
    },
    [loadDiff],
  )

  const handleStage = useCallback(
    async (paths: string[]) => {
      await stage(paths)
    },
    [stage],
  )

  const handleUnstage = useCallback(
    async (paths: string[]) => {
      await unstage(paths)
    },
    [unstage],
  )

  const staged = gitStatus?.staged ?? []
  const unstaged_ = gitStatus?.unstaged ?? []
  const untracked = gitStatus?.untracked ?? []
  const totalChanges = staged.length + unstaged_.length + untracked.length

  return (
    <div className={cn('relative flex flex-col', className)}>
      {toast && <Notification toast={toast} onDismiss={() => setToast(null)} />}

      <Toolbar branchInfo={branchInfo} onPush={handlePush} />

      {totalChanges === 0 && !loading && gitStatus !== null ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          No changes
        </div>
      ) : totalChanges === 0 && !gitStatus ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="flex overflow-hidden" style={{ height: 320 }}>
            <FileList
              staged={staged}
              unstaged={unstaged_}
              untracked={untracked}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              onStage={handleStage}
              onUnstage={handleUnstage}
            />
            <DiffViewer diffText={diffText} loading={loading} />
          </div>

          <CommitBox
            branchName={branchInfo?.name ?? 'main'}
            hasStaged={staged.length > 0}
            onCommit={handleCommit}
          />
        </>
      )}
    </div>
  )
}
