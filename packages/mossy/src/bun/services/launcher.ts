import { getShellEnv } from './shell-env'
import { IDE_REGISTRY } from '../../shared/ide-registry'
import { TERMINAL_REGISTRY } from '../../shared/terminal-registry'
import type { IdeId } from '../../shared/types'
import type { TerminalId } from '../../shared/types'

export async function launchIde(ideId: IdeId, worktreePath: string): Promise<void> {
  const ide = IDE_REGISTRY[ideId]
  const env = await getShellEnv()
  const proc = Bun.spawn([...ide.command, worktreePath], { stdout: 'pipe', stderr: 'pipe', env })
  await proc.exited
}

export async function launchTerminal(terminalId: TerminalId, worktreePath: string): Promise<void> {
  const terminal = TERMINAL_REGISTRY[terminalId]
  const env = await getShellEnv()
  Bun.spawn(['open', '-a', terminal.appName, worktreePath], {
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
