import { useState, useEffect } from 'react'
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react'
import { rpc } from '../rpc'
import { cn } from '../lib/utils'
import type { RepoConfig } from '../shared/types'

interface AddWorktreeModalProps {
  repo: RepoConfig
  opened: boolean
  onClose: () => void
  onCreated: (worktreePath: string) => void
  initialBranch?: string
}

export function AddWorktreeModal({ repo, opened, onClose, onCreated, initialBranch }: AddWorktreeModalProps) {
  const [branch, setBranch] = useState('')
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [defaultBranch, setDefaultBranch] = useState<string | null>(null)
  const [remoteBranches, setRemoteBranches] = useState<string[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [branchExists, setBranchExists] = useState(false)
  const [worktreeBasePath, setWorktreeBasePath] = useState('~/Developer/worktrees')
  const [branchFilter, setBranchFilter] = useState('')

  useEffect(() => {
    if (opened) {
      setBranch(initialBranch ?? '')
      setMode('new')
      setError(null)
      setSubmitting(false)
      setBranchExists(false)
      setRemoteBranches([])
      setBranchFilter('')
      rpc().request['git:defaultBranch']({ repoPath: repo.path }).then(setDefaultBranch).catch(() => setDefaultBranch('main'))
      rpc().request['config:get']({}).then((cfg) => setWorktreeBasePath(cfg.worktreeBasePath || '~/Developer/worktrees'))
    }
  }, [opened, repo.path, initialBranch])

  useEffect(() => {
    if (opened && mode === 'existing') {
      setLoadingBranches(true)
      setBranch('')
      setBranchFilter('')
      rpc().request['git:remoteBranches']({ repoPath: repo.path })
        .then(setRemoteBranches)
        .catch(() => setRemoteBranches([]))
        .finally(() => setLoadingBranches(false))
    }
  }, [opened, mode, repo.path])

  if (!opened) return null

  const slug = repo.name.toLowerCase().replace(/\s+/g, '-')
  const pathPreview = branch ? `${worktreeBasePath}/${slug}/${branch}` : null
  const canSubmit = branch.trim().length > 0 && !submitting

  const filteredBranches = branchFilter
    ? remoteBranches.filter((b) => b.toLowerCase().includes(branchFilter.toLowerCase()))
    : remoteBranches

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const isNewBranch = mode === 'new' && !branchExists
    const result = await rpc().request['git:addWorktree']({
      repoPath: repo.path,
      repoName: repo.name,
      branch: branch.trim(),
      isNewBranch
    })
    setSubmitting(false)
    if (result.success) {
      onCreated(result.worktreePath!)
      onClose()
    } else if (mode === 'new' && !branchExists && result.error?.includes('already exists')) {
      setBranchExists(true)
    } else {
      setError(result.error || 'Failed to create worktree')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-card rounded-lg border shadow-lg max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-foreground mb-4">Add worktree to {repo.name}</h3>

        {/* Mode toggle */}
        <div className="flex bg-background rounded-md p-0.5 mb-4">
          <button
            className={cn('flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors', mode === 'new' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => { setMode('new'); setBranch(''); setError(null); setBranchExists(false) }}
          >New branch</button>
          <button
            className={cn('flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors', mode === 'existing' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => { setMode('existing'); setBranch(''); setError(null); setBranchExists(false) }}
          >Existing branch</button>
        </div>

        <div className="flex flex-col gap-4">
          {mode === 'new' ? (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Branch name</label>
              <input
                type="text"
                placeholder="feat/my-feature"
                value={branch}
                onChange={(e) => { setBranch(e.target.value); setError(null); setBranchExists(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Branch</label>
              <input
                type="text"
                placeholder={loadingBranches ? 'Fetching branches...' : 'Search branches...'}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                disabled={loadingBranches}
                autoFocus
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono mb-1"
              />
              {loadingBranches ? (
                <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <span className="animate-spin h-3 w-3 border border-muted-foreground border-t-transparent rounded-full" />
                  Loading...
                </div>
              ) : (
                <div className="max-h-40 overflow-auto bg-background border rounded-md">
                  {filteredBranches.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[#484f58]">No matching branches</div>
                  ) : (
                    filteredBranches.map((b) => (
                      <button
                        key={b}
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors',
                          branch === b ? 'bg-accent text-foreground' : 'text-muted-foreground'
                        )}
                        onClick={() => { setBranch(b); setError(null) }}
                      >{b}</button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {mode === 'new' && defaultBranch && !branchExists && (
            <p className="text-xs text-muted-foreground">Will branch off <code className="bg-secondary px-1 py-0.5 rounded text-foreground">{defaultBranch}</code></p>
          )}

          {pathPreview && (
            <p className="text-xs text-muted-foreground">Path: <code className="bg-secondary px-1 py-0.5 rounded text-foreground">{pathPreview}</code></p>
          )}

          {branchExists && (
            <div className="bg-primary/10 border border-primary/30 text-primary rounded-md px-3 py-2 text-xs flex items-start gap-2">
              <IconInfoCircle size={14} className="mt-0.5 shrink-0" />
              <span>A local branch <code className="font-mono">{branch.trim()}</code> already exists. Confirm to check it out into a new worktree instead.</span>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md px-3 py-2 text-xs flex items-start gap-2">
              <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" onClick={onClose}>Cancel</button>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="animate-spin h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full" />
                  Creating...
                </span>
              ) : branchExists ? 'Use existing branch' : 'Create worktree'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
