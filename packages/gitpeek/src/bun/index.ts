import os from 'node:os'
import path from 'node:path'
import { BrowserWindow, BrowserView, Utils, ApplicationMenu } from 'electrobun/bun'
import Electrobun from 'electrobun/bun'
import { createGitService, isGitRepo } from './services/git'
import { createWatcher } from './services/watcher'
import type { GitPeekRPC } from '../shared/rpc-types'

// --- Parse CLI args ---

function parseRepoPath(): string | null {
  const args = process.argv.slice(2)
  const rawPath = args.find((a) => !a.startsWith('-'))
  if (!rawPath) return null
  return path.resolve(rawPath)
}

async function pickRepoFolder(): Promise<string | null> {
  const paths = await Utils.openFileDialog({
    startingFolder: os.homedir(),
    allowedFileTypes: '*',
    canChooseFiles: false,
    canChooseDirectory: true,
    allowsMultipleSelection: false
  })
  if (!paths || paths.length === 0) return null
  return paths[0]
}

async function resolveRepoPath(): Promise<string | null> {
  let repoPath = parseRepoPath()

  if (repoPath) {
    const isRepo = await isGitRepo(repoPath)
    if (!isRepo) {
      await Utils.showMessageBox({
        type: 'error',
        title: 'Not a git repository',
        message: `"${repoPath}" is not a git repository.`,
        buttons: ['OK'],
        defaultId: 0
      })
      return null
    }
    return repoPath
  }

  // No CLI arg — keep prompting with folder picker until valid repo or user cancels
  while (true) {
    const picked = await pickRepoFolder()
    if (!picked) return null // user cancelled

    const isRepo = await isGitRepo(picked)
    if (isRepo) return picked

    await Utils.showMessageBox({
      type: 'error',
      title: 'Not a git repository',
      message: `"${picked}" is not a git repository. Please select a git repository folder.`,
      buttons: ['OK'],
      defaultId: 0
    })
  }
}

// --- Start app ---

async function main() {
  const repoPath = await resolveRepoPath()
  if (!repoPath) {
    Utils.quit()
    return
  }

  const folderName = path.basename(repoPath)
  const gitService = createGitService(repoPath)

  // --- RPC Handlers ---

  const mainviewRPC = BrowserView.defineRPC<GitPeekRPC>({
    maxRequestTime: 60000,
    handlers: {
      requests: {
        'git:status': async () => {
          return gitService.status()
        },
        'git:diff': async ({ filePath, staged }) => {
          return gitService.diff(filePath, staged)
        },
        'git:stage': async ({ filePaths }) => {
          await gitService.stage(filePaths)
        },
        'git:unstage': async ({ filePaths }) => {
          await gitService.unstage(filePaths)
        },
        'git:commit': async ({ summary, description }) => {
          return gitService.commit(summary, description)
        },
        'git:push': async () => {
          return gitService.push()
        },
        'git:pushSetUpstream': async () => {
          return gitService.pushSetUpstream()
        },
        'git:branchInfo': async () => {
          return gitService.branchInfo()
        },
        'dialog:openDirectory': async () => {
          const paths = await Utils.openFileDialog({
            startingFolder: os.homedir(),
            allowedFileTypes: '*',
            canChooseFiles: false,
            canChooseDirectory: true,
            allowsMultipleSelection: false
          })
          if (!paths || paths.length === 0) return null
          return paths[0]
        },
        'app:repoPath': () => {
          return repoPath
        }
      },
      messages: {}
    }
  })

  // --- Application Menu ---

  ApplicationMenu.setApplicationMenu([
    {
      label: 'GitPeek',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'showAll' },
        { type: 'separator' },
        { label: 'Quit GitPeek', action: 'quit-gitpeek', accelerator: 'CmdOrCtrl+Q' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    }
  ])

  ApplicationMenu.on('application-menu-clicked', (event) => {
    const payload = event as { action?: string; data?: { action?: string } }
    const action = payload.data?.action ?? payload.action
    if (action === 'quit-gitpeek') {
      Utils.quit()
    }
  })

  // --- Main Window ---

  const win = new BrowserWindow({
    title: `GitPeek — ${folderName}`,
    url: 'views://mainview/index.html',
    titleBarStyle: 'hiddenInset',
    frame: {
      width: 1200,
      height: 800,
      x: 200,
      y: 200
    },
    rpc: mainviewRPC
  })

  // --- File Watcher ---

  const watcher = createWatcher(repoPath, () => {
    try {
      const webviewRpc = win.webview.rpc
      if (webviewRpc) {
        webviewRpc.send['files:changed']()
      }
    } catch {
      // Window may not be ready
    }
  })

  // Open external links in system browser
  Electrobun.events.on(`new-window-open-${win.webview.id}`, (event: { data?: { detail?: string | { url?: string } } }) => {
    const detail = event.data?.detail
    const url = typeof detail === 'string' ? detail : detail?.url
    if (url) {
      Utils.openExternal(url)
    }
  })
}

main()

// --- Shutdown ---

process.on('SIGINT', () => {
  Utils.quit()
})
process.on('SIGTERM', () => {
  Utils.quit()
})
