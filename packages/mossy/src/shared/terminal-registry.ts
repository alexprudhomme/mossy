import type { TerminalId } from './types'

export interface TerminalDefinition {
  id: TerminalId
  label: string
  appName: string
  color: string
}

export const TERMINAL_REGISTRY: Record<TerminalId, TerminalDefinition> = {
  ghostty: { id: 'ghostty', label: 'Ghostty', appName: 'Ghostty.app', color: 'violet' },
  iterm2: { id: 'iterm2', label: 'iTerm2', appName: 'iTerm.app', color: 'green' },
  terminal: { id: 'terminal', label: 'Terminal', appName: 'Terminal.app', color: 'blue' },
}

export const TERMINAL_OPTIONS: TerminalId[] = ['ghostty', 'iterm2', 'terminal']

export function isValidTerminalId(value: unknown): value is TerminalId {
  return typeof value === 'string' && value in TERMINAL_REGISTRY
}
