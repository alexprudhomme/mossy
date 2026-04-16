import type { RPCSchema } from 'electrobun/bun'
import type {
  AppConfig,
  BranchInfo,
  DependencyStatus,
  GitResult,
  GitStatus,
  IdeId,
  Issue,
  MergeConflictInfo,
  PRInfo,
  SetupCommandResult,
  Worktree,
  WorktreeStatus
} from './types'

export type MossyRPC = {
  bun: RPCSchema<{
    requests: {
      // Config
      'config:get': {
        params: Record<string, never>
        response: AppConfig
      }
      'config:set': {
        params: { config: AppConfig }
        response: void
      }
      'config:getCollapsed': {
        params: Record<string, never>
        response: string[]
      }
      'config:setCollapsed': {
        params: { ids: string[] }
        response: void
      }

      // Git worktree management
      'git:worktrees': {
        params: { repoPath: string }
        response: Worktree[]
      }
      'git:defaultBranch': {
        params: { repoPath: string }
        response: string
      }
      'git:remoteBranches': {
        params: { repoPath: string }
        response: string[]
      }
      'git:addWorktree': {
        params: {
          repoPath: string
          repoName: string
          branch: string
          isNewBranch: boolean
        }
        response: { success: boolean; worktreePath?: string; error?: string }
      }
      'git:runSetup': {
        params: { worktreePath: string; commands: string[] }
        response: { results: SetupCommandResult[]; allSucceeded: boolean }
      }
      'git:worktreeStatus': {
        params: { worktreePath: string }
        response: WorktreeStatus
      }
      'git:fetchRepo': {
        params: { repoPath: string }
        response: void
      }
      'git:pull': {
        params: { worktreePath: string }
        response: { success: boolean; error?: string }
      }
      'git:removeWorktree': {
        params: { repoPath: string; worktreePath: string; force?: boolean }
        response: { success: boolean; error?: string }
      }

      // Diff panel operations (run in a specific worktree)
      'git:status': {
        params: { worktreePath: string }
        response: GitStatus
      }
      'git:diff': {
        params: { worktreePath: string; filePath: string; staged: boolean }
        response: string
      }
      'git:stage': {
        params: { worktreePath: string; filePaths: string[] }
        response: void
      }
      'git:unstage': {
        params: { worktreePath: string; filePaths: string[] }
        response: void
      }
      'git:commit': {
        params: { worktreePath: string; summary: string; description?: string }
        response: GitResult
      }
      'git:push': {
        params: { worktreePath: string }
        response: GitResult
      }
      'git:branchInfo': {
        params: { worktreePath: string }
        response: BranchInfo
      }
      'git:mergeConflicts': {
        params: { worktreePath: string; repoPath: string }
        response: MergeConflictInfo
      }

      // Issues (polymorphic based on config)
      'issues:current': {
        params: { issueKey: string; repoPath?: string }
        response: Issue | null
      }
      'issues:mine': {
        params: Record<string, never>
        response: Issue[]
      }

      // GitHub PR
      'gh:pr': {
        params: { repoPath: string; branch: string }
        response: PRInfo | null
      }

      // Launcher
      'launch:ide': {
        params: { ideId: IdeId; worktreePath: string }
        response: void
      }
      'launch:ghostty': {
        params: { worktreePath: string }
        response: void
      }
      'launch:url': {
        params: { url: string }
        response: { success: boolean; error?: string }
      }

      // System
      'system:homedir': {
        params: Record<string, never>
        response: string
      }
      'dialog:openDirectory': {
        params: Record<string, never>
        response: string | null
      }
      'system:dependencies': {
        params: { refresh?: boolean }
        response: DependencyStatus
      }

      // App
      'app:quit': {
        params: Record<string, never>
        response: void
      }
      'app:closeWindow': {
        params: Record<string, never>
        response: void
      }
      'app:toggleZoom': {
        params: Record<string, never>
        response: void
      }
      'app:version': {
        params: Record<string, never>
        response: string
      }
      'app:checkForUpdates': {
        params: Record<string, never>
        response: { success: boolean; updateAvailable: boolean; error?: string }
      }
    }
    messages: Record<string, never>
  }>
  webview: RPCSchema<{
    requests: Record<string, never>
    messages: {
      'ui:openSettings': void
      'ui:zoomIn': void
      'ui:zoomOut': void
      'ui:zoomReset': void
    }
  }>
}
