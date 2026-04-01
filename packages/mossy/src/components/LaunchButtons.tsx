import { IconGhost } from '@tabler/icons-react'
import { IdeIcon } from './IdeIcon'
import { IDE_REGISTRY } from '../shared/ide-registry'
import { rpc } from '../rpc'
import type { IdeId } from '../shared/types'

interface LaunchButtonsProps {
  worktreePath: string
  defaultIde: IdeId
}

export function LaunchButtons({ worktreePath, defaultIde }: LaunchButtonsProps) {
  const ide = IDE_REGISTRY[defaultIde]

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => rpc().request['launch:ide']({ ideId: defaultIde, worktreePath })}
        title={`Open in ${ide.label}`}
        className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <IdeIcon ide={defaultIde} size={16} />
      </button>
      <button
        onClick={() => rpc().request['launch:ghostty']({ worktreePath })}
        title="Open Ghostty terminal"
        className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:bg-accent hover:text-[#a371f7] transition-colors"
      >
        <IconGhost size={16} />
      </button>
    </div>
  )
}
