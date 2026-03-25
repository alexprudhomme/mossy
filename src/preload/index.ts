import { contextBridge, ipcRenderer } from 'electron'

const repoPathArg = process.argv.find((a) => a.startsWith('--repo-path='))
const repoPath = repoPathArg ? repoPathArg.split('=')[1] : ''

// We use the window's webContents ID which is embedded in the IPC channel prefix
// The main process registers handlers with prefix `git:${win.id}:`
// We need to get the window ID - electron provides it via additionalArguments
// We'll use a simpler approach: get the ID from the main process

let windowId: number | null = null

const api = {
  getRepoPath: () => repoPath,

  setWindowId: (id: number) => {
    windowId = id
  },

  git: {
    status: () => ipcRenderer.invoke(`git:${windowId}:status`),
    diff: (filePath: string, staged: boolean) =>
      ipcRenderer.invoke(`git:${windowId}:diff`, filePath, staged),
    stage: (filePaths: string[]) =>
      ipcRenderer.invoke(`git:${windowId}:stage`, filePaths),
    unstage: (filePaths: string[]) =>
      ipcRenderer.invoke(`git:${windowId}:unstage`, filePaths),
    commit: (summary: string, description?: string) =>
      ipcRenderer.invoke(`git:${windowId}:commit`, summary, description),
    push: () => ipcRenderer.invoke(`git:${windowId}:push`),
    pushSetUpstream: () =>
      ipcRenderer.invoke(`git:${windowId}:push-set-upstream`),
    branchInfo: () => ipcRenderer.invoke(`git:${windowId}:branch-info`)
  },

  onFilesChanged: (callback: () => void) => {
    ipcRenderer.on('files:changed', callback)
    return () => {
      ipcRenderer.removeListener('files:changed', callback)
    }
  },

  getWindowId: () => ipcRenderer.invoke('get-window-id')
}

contextBridge.exposeInMainWorld('gitpeek', api)
