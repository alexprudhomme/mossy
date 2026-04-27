import { IdeIcon } from './IdeIcon'
import { TerminalIcon } from './TerminalIcon'
import { IDE_REGISTRY } from '../shared/ide-registry'
import { TERMINAL_REGISTRY } from '../shared/terminal-registry'
import { rpc } from '../rpc'
import type { IdeId, TerminalId } from '../shared/types'

const IDE_HOVER_COLOR: Record<string, string> = {
  blue: 'hover:text-blue-400',
  violet: 'hover:text-violet-400',
  orange: 'hover:text-orange-400',
  cyan: 'hover:text-cyan-400',
  lime: 'hover:text-lime-400',
  yellow: 'hover:text-yellow-400',
  green: 'hover:text-green-400',
}

interface LaunchButtonsProps {
  worktreePath: string
  defaultIde: IdeId
  defaultTerminal: TerminalId
}

export function LaunchButtons({ worktreePath, defaultIde, defaultTerminal }: LaunchButtonsProps) {
  const ide = IDE_REGISTRY[defaultIde]
  const terminal = TERMINAL_REGISTRY[defaultTerminal]
  const ideHoverColor = IDE_HOVER_COLOR[ide.color] ?? 'hover:text-foreground'
  const terminalHoverColor = IDE_HOVER_COLOR[terminal.color] ?? 'hover:text-foreground'

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => rpc().request['launch:ide']({ ideId: defaultIde, worktreePath })}
        title={`Open in ${ide.label}`}
        className={`inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:bg-accent ${ideHoverColor} transition-colors`}
      >
        <IdeIcon ide={defaultIde} size={16} />
      </button>
      <button
        onClick={() => rpc().request['launch:terminal']({ terminalId: defaultTerminal, worktreePath })}
        title={`Open ${terminal.label} terminal`}
        className={`inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:bg-accent ${terminalHoverColor} transition-colors`}
      >
        <TerminalIcon terminal={defaultTerminal} size={16} />
      </button>
    </div>
  )
}
