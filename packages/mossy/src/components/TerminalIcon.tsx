import { IconGhost, IconTerminal } from '@tabler/icons-react'
import type { TerminalId } from '../shared/types'

interface TerminalIconProps {
  terminal: TerminalId
  size?: number
}

function ITerm2Icon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 15l4-4-4-4" />
      <path d="M13 15h4" />
    </svg>
  )
}

const TERMINAL_ICON_MAP: Record<TerminalId, ({ size }: { size: number }) => React.ReactElement> = {
  ghostty: ({ size }) => <IconGhost size={size} />,
  iterm2: ITerm2Icon,
  terminal: ({ size }) => <IconTerminal size={size} />,
}

export function TerminalIcon({ terminal, size = 16 }: TerminalIconProps) {
  const Icon = TERMINAL_ICON_MAP[terminal]
  return <Icon size={size} />
}
