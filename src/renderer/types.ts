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

declare global {
  interface Window {
    gitpeek: {
      getRepoPath: () => string
      setWindowId: (id: number) => void
      getWindowId: () => Promise<number>
      git: {
        status: () => Promise<GitStatus>
        diff: (filePath: string, staged: boolean) => Promise<string>
        stage: (filePaths: string[]) => Promise<void>
        unstage: (filePaths: string[]) => Promise<void>
        commit: (summary: string, description?: string) => Promise<GitResult>
        push: () => Promise<GitResult>
        pushSetUpstream: () => Promise<GitResult>
        branchInfo: () => Promise<BranchInfo>
      }
      onFilesChanged: (callback: () => void) => () => void
    }
  }
}
