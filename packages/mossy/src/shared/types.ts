// Shared types used across bun and view processes

export type IdeId = 'vscode' | 'cursor' | 'intellij' | 'webstorm' | 'zed' | 'sublime'
export type IssueTracker = 'jira' | 'github' | 'none'

export interface RepoConfig {
  id: string
  name: string
  path: string
  setupCommands?: string[]
}

export interface AppConfig {
  repositories: RepoConfig[]
  worktreeBasePath: string
  issueTracker: IssueTracker
  pollIntervalSec: number
  fetchIntervalSec: number
  autoUpdateEnabled: boolean
  updateCheckIntervalMin: number
  collapsedRepos: string[]
  defaultIde: IdeId
  issuePanelOpen: boolean
  issuePanelWidth: number
}

export interface Worktree {
  path: string
  branch: string
  head: string
  isMain: boolean
}

export interface Issue {
  key: string
  summary: string
  status: string
  assignee: string | null
  issueType: string
  url: string
}

export interface PRInfo {
  number: number
  url: string
  title: string
  state: 'OPEN' | 'CLOSED' | 'MERGED'
  isDraft: boolean
  ciStatus: 'SUCCESS' | 'FAILURE' | 'PENDING' | null
  ciFailed: number
  ciTotal: number
}

export interface WorktreeStatus {
  hasUncommittedChanges: boolean
  unpushedCommits: number
  unpulledCommits: number
  linesAdded: number
  linesDeleted: number
}

export interface SetupCommandResult {
  command: string
  success: boolean
  output: string
}

export interface DependencyCheck {
  name: 'gh' | 'jira'
  required: boolean
  installed: boolean
  authenticated: boolean | null
  version: string | null
  error: string | null
  authError: string | null
}

export interface DependencyStatus {
  checkedAt: string
  checks: DependencyCheck[]
}

// Diff panel types
export interface FileEntry {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  oldPath?: string
}

export interface GitStatus {
  staged: FileEntry[]
  unstaged: FileEntry[]
  untracked: FileEntry[]
}

export interface BranchInfo {
  name: string
  ahead: number
  behind: number
  hasUpstream: boolean
}

export interface GitResult {
  success: boolean
  error?: string
}

export interface MergeConflictInfo {
  hasConflicts: boolean
  conflictCount: number
  conflictFiles: string[]
  targetBranch: string
}
