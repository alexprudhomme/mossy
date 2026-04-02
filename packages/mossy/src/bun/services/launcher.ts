import { getShellEnv } from './shell-env'
import { IDE_REGISTRY } from '../../shared/ide-registry'
import type { IdeId } from '../../shared/types'

export async function launchIde(ideId: IdeId, worktreePath: string): Promise<void> {
  const ide = IDE_REGISTRY[ideId]
  const env = await getShellEnv()
  const proc = Bun.spawn([...ide.command, worktreePath], { stdout: 'pipe', stderr: 'pipe', env })
  await proc.exited
}

export async function launchGhostty(worktreePath: string, command?: string): Promise<void> {
  const env = await getShellEnv()
  if (command) {
    // macOS ignores --args for already-running apps, so -n is needed to
    // guarantee the flags reach Ghostty. This opens a new window.
    Bun.spawn(
      ['open', '-n', '-a', 'Ghostty.app', '--args', `--working-directory=${worktreePath}`, '-e', command],
      { stdout: 'ignore', stderr: 'ignore', env }
    )
  } else {
    // Pass the directory as a file arg. Ghostty opens a new tab in the
    // directory when it's already running, or a new window if it isn't.
    Bun.spawn(
      ['open', '-a', 'Ghostty.app', worktreePath],
      { stdout: 'ignore', stderr: 'ignore', env }
    )
  }
}

export async function launchURL(url: string): Promise<void> {
  const proc = Bun.spawn(['/usr/bin/open', url], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error('Failed to open URL')
  }
}
