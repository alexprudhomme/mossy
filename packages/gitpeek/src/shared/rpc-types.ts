import type { RPCSchema } from 'electrobun/bun'
import type { GitStatus, BranchInfo, GitResult } from './types'

export type GitPeekRPC = {
  bun: RPCSchema<{
    requests: {
      'git:status': {
        params: Record<string, never>
        response: GitStatus
      }
      'git:diff': {
        params: { filePath: string; staged: boolean }
        response: string
      }
      'git:stage': {
        params: { filePaths: string[] }
        response: void
      }
      'git:unstage': {
        params: { filePaths: string[] }
        response: void
      }
      'git:commit': {
        params: { summary: string; description?: string }
        response: GitResult
      }
      'git:push': {
        params: Record<string, never>
        response: GitResult
      }
      'git:pushSetUpstream': {
        params: Record<string, never>
        response: GitResult
      }
      'git:branchInfo': {
        params: Record<string, never>
        response: BranchInfo
      }
      'dialog:openDirectory': {
        params: Record<string, never>
        response: string | null
      }
      'app:repoPath': {
        params: Record<string, never>
        response: string
      }
    }
    messages: Record<string, never>
  }>
  webview: RPCSchema<{
    requests: Record<string, never>
    messages: {
      'files:changed': void
    }
  }>
}
