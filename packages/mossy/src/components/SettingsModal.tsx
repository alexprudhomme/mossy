import { useState, useEffect } from 'react'
import {
  IconSettings,
  IconCode,
  IconRefresh,
  IconPackage,
  IconPlus,
  IconTrash,
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconFolder,
  IconExternalLink,
  IconAlertCircle,
  IconCircleCheck,
} from '@tabler/icons-react'
import { cn } from '../lib/utils'
import { rpc } from '../rpc'
import { IDE_REGISTRY, IDE_OPTIONS } from '../shared/ide-registry'
import { IdeIcon } from './IdeIcon'
import type {
  AppConfig,
  RepoConfig,
  IdeId,
  IssueTracker,
  DependencyStatus,
  DependencyCheck,
} from '../shared/types'

type Section = 'general' | 'editor' | 'updates' | 'dependencies'

interface SettingsModalProps {
  opened: boolean
  onClose: () => void
  config: AppConfig | null
  addRepo: (name: string, path: string) => Promise<void>
  removeRepo: (id: string) => Promise<void>
  setPollInterval: (sec: number) => Promise<void>
  setFetchInterval: (sec: number) => Promise<void>
  setAutoUpdateEnabled: (enabled: boolean) => Promise<void>
  setUpdateCheckInterval: (minutes: number) => Promise<void>
  setDefaultIde: (ide: IdeId) => Promise<void>
  setRepoSetupCommands: (repoId: string, commands: string[]) => Promise<void>
  setIssueTracker: (tracker: IssueTracker) => Promise<void>
  setWorktreeBasePath: (path: string) => Promise<void>
  onDependencyStatusChange?: (status: DependencyStatus) => void
}

const NAV_ITEMS: { id: Section; label: string; icon: typeof IconSettings }[] = [
  { id: 'general', label: 'General', icon: IconSettings },
  { id: 'editor', label: 'Editor', icon: IconCode },
  { id: 'updates', label: 'Updates', icon: IconRefresh },
  { id: 'dependencies', label: 'Dependencies', icon: IconPackage },
]

const ISSUE_TRACKER_OPTIONS: { value: IssueTracker; label: string }[] = [
  { value: 'jira', label: 'Jira' },
  { value: 'github', label: 'GitHub Issues' },
  { value: 'none', label: 'None' },
]

export function SettingsModal({
  opened,
  onClose,
  config,
  addRepo,
  removeRepo,
  setPollInterval,
  setFetchInterval,
  setAutoUpdateEnabled,
  setUpdateCheckInterval,
  setDefaultIde,
  setRepoSetupCommands,
  setIssueTracker,
  setWorktreeBasePath,
  onDependencyStatusChange,
}: SettingsModalProps) {
  const [section, setSection] = useState<Section>('general')
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoPath, setNewRepoPath] = useState('')
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null)
  const [editingCommands, setEditingCommands] = useState('')
  const [basePathInput, setBasePathInput] = useState('')
  const [depStatus, setDepStatus] = useState<DependencyStatus | null>(null)
  const [checkingDeps, setCheckingDeps] = useState(false)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updateResult, setUpdateResult] = useState<string | null>(null)

  useEffect(() => {
    if (opened && config) {
      setBasePathInput(config.worktreeBasePath || '~/Developer/worktrees')
      setNewRepoName('')
      setNewRepoPath('')
      setExpandedRepo(null)
      setUpdateResult(null)
    }
  }, [opened, config])

  useEffect(() => {
    if (opened && section === 'dependencies') {
      checkDependencies()
    }
  }, [opened, section])

  if (!opened || !config) return null

  async function checkDependencies() {
    setCheckingDeps(true)
    try {
      const status = await rpc().request['system:checkDependencies']({})
      setDepStatus(status)
      onDependencyStatusChange?.(status)
    } catch {
      setDepStatus(null)
    } finally {
      setCheckingDeps(false)
    }
  }

  async function handleAddRepo() {
    if (!newRepoName.trim() || !newRepoPath.trim()) return
    await addRepo(newRepoName.trim(), newRepoPath.trim())
    setNewRepoName('')
    setNewRepoPath('')
  }

  async function handleBrowseBasePath() {
    try {
      const result = await rpc().request['system:selectDirectory']({})
      if (result) {
        setBasePathInput(result)
        await setWorktreeBasePath(result)
      }
    } catch {
      // Dialog cancelled or unavailable
    }
  }

  async function handleSaveBasePath() {
    if (basePathInput.trim()) {
      await setWorktreeBasePath(basePathInput.trim())
    }
  }

  function toggleRepoExpand(repoId: string, commands?: string[]) {
    if (expandedRepo === repoId) {
      setExpandedRepo(null)
    } else {
      setExpandedRepo(repoId)
      setEditingCommands((commands ?? []).join('\n'))
    }
  }

  async function handleSaveCommands(repoId: string) {
    const cmds = editingCommands
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean)
    await setRepoSetupCommands(repoId, cmds)
    setExpandedRepo(null)
  }

  async function handleCheckUpdate() {
    setCheckingUpdates(true)
    setUpdateResult(null)
    try {
      const result = await rpc().request['system:checkForUpdates']({})
      setUpdateResult(result.available ? `Update available: ${result.version}` : 'You are on the latest version.')
    } catch {
      setUpdateResult('Failed to check for updates.')
    } finally {
      setCheckingUpdates(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-card rounded-lg border shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <nav className="w-40 shrink-0 border-r py-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors mx-1 rounded',
                section === id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              onClick={() => setSection(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {section === 'general' && (
            <GeneralSection
              config={config}
              newRepoName={newRepoName}
              setNewRepoName={setNewRepoName}
              newRepoPath={newRepoPath}
              setNewRepoPath={setNewRepoPath}
              onAddRepo={handleAddRepo}
              onRemoveRepo={removeRepo}
              expandedRepo={expandedRepo}
              editingCommands={editingCommands}
              setEditingCommands={setEditingCommands}
              onToggleExpand={toggleRepoExpand}
              onSaveCommands={handleSaveCommands}
              basePathInput={basePathInput}
              setBasePathInput={setBasePathInput}
              onBrowseBasePath={handleBrowseBasePath}
              onSaveBasePath={handleSaveBasePath}
              onSetIssueTracker={setIssueTracker}
              onSetPollInterval={setPollInterval}
              onSetFetchInterval={setFetchInterval}
            />
          )}

          {section === 'editor' && (
            <EditorSection config={config} onSetDefaultIde={setDefaultIde} />
          )}

          {section === 'updates' && (
            <UpdatesSection
              config={config}
              onSetAutoUpdate={setAutoUpdateEnabled}
              onSetCheckInterval={setUpdateCheckInterval}
              onCheckUpdate={handleCheckUpdate}
              checkingUpdates={checkingUpdates}
              updateResult={updateResult}
            />
          )}

          {section === 'dependencies' && (
            <DependenciesSection
              depStatus={depStatus}
              checkingDeps={checkingDeps}
              onRecheck={checkDependencies}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  General Section                                                    */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">{children}</h4>
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1">{children}</label>
}

interface GeneralSectionProps {
  config: AppConfig
  newRepoName: string
  setNewRepoName: (v: string) => void
  newRepoPath: string
  setNewRepoPath: (v: string) => void
  onAddRepo: () => void
  onRemoveRepo: (id: string) => Promise<void>
  expandedRepo: string | null
  editingCommands: string
  setEditingCommands: (v: string) => void
  onToggleExpand: (repoId: string, commands?: string[]) => void
  onSaveCommands: (repoId: string) => void
  basePathInput: string
  setBasePathInput: (v: string) => void
  onBrowseBasePath: () => void
  onSaveBasePath: () => void
  onSetIssueTracker: (tracker: IssueTracker) => Promise<void>
  onSetPollInterval: (sec: number) => Promise<void>
  onSetFetchInterval: (sec: number) => Promise<void>
}

function GeneralSection({
  config,
  newRepoName,
  setNewRepoName,
  newRepoPath,
  setNewRepoPath,
  onAddRepo,
  onRemoveRepo,
  expandedRepo,
  editingCommands,
  setEditingCommands,
  onToggleExpand,
  onSaveCommands,
  basePathInput,
  setBasePathInput,
  onBrowseBasePath,
  onSaveBasePath,
  onSetIssueTracker,
  onSetPollInterval,
  onSetFetchInterval,
}: GeneralSectionProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Repositories */}
      <div>
        <SectionHeading>Repositories</SectionHeading>
        {config.repositories.length > 0 ? (
          <div className="border rounded-md overflow-hidden mb-3">
            {config.repositories.map((repo) => (
              <div key={repo.id} className="border-b last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => onToggleExpand(repo.id, repo.setupCommands)}
                  >
                    {expandedRepo === repo.id ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
                  </button>
                  <span className="text-xs font-medium text-foreground flex-1">{repo.name}</span>
                  <span className="text-xs text-[#484f58] truncate max-w-[200px]">{repo.path}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                    onClick={() => onRemoveRepo(repo.id)}
                  >
                    <IconTrash size={12} />
                  </button>
                </div>
                {expandedRepo === repo.id && (
                  <div className="px-3 pb-3 pt-1 bg-background">
                    <FieldLabel>Setup commands (one per line)</FieldLabel>
                    <textarea
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono resize-none"
                      rows={3}
                      value={editingCommands}
                      onChange={(e) => setEditingCommands(e.target.value)}
                      placeholder="npm install&#10;npm run build"
                    />
                    <div className="flex justify-end mt-1.5">
                      <button
                        className="px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        onClick={() => onSaveCommands(repo.id)}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#484f58] mb-3">No repositories configured.</p>
        )}

        {/* Add repo form */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <FieldLabel>Name</FieldLabel>
            <input
              type="text"
              placeholder="my-project"
              value={newRepoName}
              onChange={(e) => setNewRepoName(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex-1">
            <FieldLabel>Path</FieldLabel>
            <input
              type="text"
              placeholder="/path/to/repo"
              value={newRepoPath}
              onChange={(e) => setNewRepoPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onAddRepo() }}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
            onClick={onAddRepo}
            disabled={!newRepoName.trim() || !newRepoPath.trim()}
          >
            <IconPlus size={14} />
          </button>
        </div>
      </div>

      {/* Worktree Base Path */}
      <div>
        <SectionHeading>Worktree Base Path</SectionHeading>
        <div className="flex gap-2">
          <input
            type="text"
            value={basePathInput}
            onChange={(e) => setBasePathInput(e.target.value)}
            onBlur={onSaveBasePath}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveBasePath() }}
            className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          />
          <button
            className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
            onClick={onBrowseBasePath}
          >
            <IconFolder size={14} />
          </button>
        </div>
        <p className="text-xs text-[#484f58] mt-1">Directory where new worktrees will be created.</p>
      </div>

      {/* Issue Tracker */}
      <div>
        <SectionHeading>Issue Tracker</SectionHeading>
        <div className="flex bg-background rounded-md p-0.5 gap-0.5">
          {ISSUE_TRACKER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                config.issueTracker === value
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onSetIssueTracker(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Intervals */}
      <div>
        <SectionHeading>Polling</SectionHeading>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Status poll interval (sec)</FieldLabel>
            <input
              type="number"
              min={5}
              max={300}
              value={config.pollIntervalSec}
              onChange={(e) => onSetPollInterval(Math.max(5, Number(e.target.value)))}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <FieldLabel>Fetch interval (sec)</FieldLabel>
            <input
              type="number"
              min={30}
              max={3600}
              value={config.fetchIntervalSec}
              onChange={(e) => onSetFetchInterval(Math.max(30, Number(e.target.value)))}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Editor Section                                                     */
/* ------------------------------------------------------------------ */

function EditorSection({
  config,
  onSetDefaultIde,
}: {
  config: AppConfig
  onSetDefaultIde: (ide: IdeId) => Promise<void>
}) {
  return (
    <div>
      <SectionHeading>Default Editor</SectionHeading>
      <p className="text-xs text-[#484f58] mb-4">Choose which editor opens when you click a worktree.</p>
      <div className="flex flex-col gap-0.5">
        {IDE_OPTIONS.map((ide) => {
          const def = IDE_REGISTRY[ide]
          const selected = config.defaultIde === ide
          return (
            <button
              key={ide}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                selected
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
              onClick={() => onSetDefaultIde(ide)}
            >
              <IdeIcon ide={ide} size={18} />
              <span className="text-sm font-medium flex-1">{def.label}</span>
              {selected && <IconCheck size={14} className="text-primary" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Updates Section                                                    */
/* ------------------------------------------------------------------ */

function UpdatesSection({
  config,
  onSetAutoUpdate,
  onSetCheckInterval,
  onCheckUpdate,
  checkingUpdates,
  updateResult,
}: {
  config: AppConfig
  onSetAutoUpdate: (enabled: boolean) => Promise<void>
  onSetCheckInterval: (minutes: number) => Promise<void>
  onCheckUpdate: () => void
  checkingUpdates: boolean
  updateResult: string | null
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionHeading>Automatic Updates</SectionHeading>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.autoUpdateEnabled}
            onChange={(e) => onSetAutoUpdate(e.target.checked)}
            className="accent-primary w-3.5 h-3.5"
          />
          <span className="text-sm text-foreground">Enable automatic update checks</span>
        </label>
      </div>

      {config.autoUpdateEnabled && (
        <div>
          <FieldLabel>Check interval (minutes)</FieldLabel>
          <input
            type="number"
            min={5}
            max={1440}
            value={config.updateCheckIntervalMin}
            onChange={(e) => onSetCheckInterval(Math.max(5, Number(e.target.value)))}
            className="w-40 bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div>
        <SectionHeading>Manual Check</SectionHeading>
        <button
          className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          onClick={onCheckUpdate}
          disabled={checkingUpdates}
        >
          {checkingUpdates ? (
            <span className="flex items-center gap-1.5">
              <span className="animate-spin h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full" />
              Checking...
            </span>
          ) : (
            'Check for updates'
          )}
        </button>
        {updateResult && (
          <div className={cn(
            'mt-3 rounded-md px-3 py-2 text-xs flex items-start gap-2',
            updateResult.includes('latest')
              ? 'bg-success/10 border border-success/30 text-success'
              : updateResult.includes('available')
                ? 'bg-primary/10 border border-primary/30 text-primary'
                : 'bg-destructive/10 border border-destructive/30 text-destructive'
          )}>
            {updateResult.includes('latest') ? (
              <IconCircleCheck size={14} className="mt-0.5 shrink-0" />
            ) : (
              <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
            )}
            <span>{updateResult}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Dependencies Section                                               */
/* ------------------------------------------------------------------ */

const INSTALL_LINKS: Record<string, string> = {
  gh: 'https://cli.github.com',
  jira: 'https://github.com/ankitpokhrel/jira-cli',
}

function DependenciesSection({
  depStatus,
  checkingDeps,
  onRecheck,
}: {
  depStatus: DependencyStatus | null
  checkingDeps: boolean
  onRecheck: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Dependencies</SectionHeading>
        <button
          className="px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1"
          onClick={onRecheck}
          disabled={checkingDeps}
        >
          <IconRefresh size={12} className={checkingDeps ? 'animate-spin' : ''} />
          Recheck
        </button>
      </div>

      {checkingDeps && (
        <div className="flex items-center justify-center gap-2 py-4">
          <span className="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground">Checking dependencies...</span>
        </div>
      )}

      {!checkingDeps && !depStatus && (
        <p className="text-xs text-[#484f58]">Could not check dependency status.</p>
      )}

      {!checkingDeps && depStatus && (
        <div className="flex flex-col gap-2">
          {depStatus.checks.map((check) => (
            <DependencyRow key={check.name} check={check} />
          ))}
          <p className="text-xs text-[#484f58] mt-2">
            Last checked: {new Date(depStatus.checkedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}

function DependencyRow({ check }: { check: DependencyCheck }) {
  const ok = check.installed && (check.authenticated === null || check.authenticated)

  return (
    <div className="flex items-center gap-3 px-3 py-2 border rounded-md">
      <div className={cn('shrink-0', ok ? 'text-success' : 'text-warning')}>
        {ok ? <IconCircleCheck size={16} /> : <IconAlertCircle size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{check.name}</span>
          {check.version && <span className="text-xs text-[#484f58]">v{check.version}</span>}
        </div>
        {!check.installed && (
          <p className="text-xs text-warning">Not installed</p>
        )}
        {check.installed && check.authenticated === false && (
          <p className="text-xs text-warning">{check.authError || 'Not authenticated'}</p>
        )}
        {check.error && (
          <p className="text-xs text-destructive">{check.error}</p>
        )}
      </div>
      {!check.installed && INSTALL_LINKS[check.name] && (
        <a
          href={INSTALL_LINKS[check.name]}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          Install <IconExternalLink size={10} />
        </a>
      )}
    </div>
  )
}
