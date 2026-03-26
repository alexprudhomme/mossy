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
