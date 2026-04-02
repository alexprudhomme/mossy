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
  const args = ['open', '-n', '-a', 'Ghostty.app', '--args', `--working-directory=${worktreePath}`]
  if (command) {
    args.push('-e', command)
  }
  Bun.spawn(args, {
    stdout: 'ignore',
    stderr: 'ignore',
    env
  })
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
