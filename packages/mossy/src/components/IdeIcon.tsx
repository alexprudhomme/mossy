import { IconBrandVscode } from '@tabler/icons-react'
import type { IdeId } from '../shared/types'

interface IdeIconProps {
  ide: IdeId
  size?: number
}

function CursorIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l12 9-5 1-3 5z" />
      <path d="M13 13l5 5" />
    </svg>
  )
}

function IntelliJIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 17h5" />
      <path d="M8 7h2v6H8z" fill="currentColor" />
      <path d="M12 7h2l2 3-2 3h-2l2-3z" />
    </svg>
  )
}

function KiroIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 8.74c-.37-3.56-2.43-8.12-7.83-8.3h-.4C7.42.44 4.55 3.26 3.95 7.19c-.35 1.19-.32 2.68-.63 4.52-.32 1.92-.95 2.61-1.39 3.73-.24.66-.15 2.27 1.4 2.4.85.08 1.92-.36 1.93-.51-.29.59-.66 1.66-.58 2.56.08 1.5 1.12 2.29 2.74 2.29 1.82 0 3.11-1.08 3.91-1.57.39 1 .89 1.57 1.85 1.57 1.68 0 3.55-1.69 4.36-3.04 1.44-2.52 2.35-5.47 2.08-9.13-.01-.37-.05-.78-.1-1.14z" />
      <path d="M11.33 5.95c-.94-.07-.95 1.08-.95 1.81 0 .78.21 1.69 1.03 1.69.85 0 1.08-1.04 1.08-1.69 0-.72-.21-1.81-1.16-1.81z" fill="currentColor" stroke="none" />
      <path d="M14.89 5.95c-.93-.07-1.05.97-1.05 1.81 0 .75.2 1.69 1.04 1.69.95 0 1.07-1.23 1.07-1.69 0-.76-.26-1.81-1.06-1.81z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function WebStormIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 17h5" />
      <path d="M7 8l2 6 2-4 2 4 2-6" />
    </svg>
  )
}

function ZedIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h10l-10 10h10" />
    </svg>
  )
}

function SublimeIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8l12-3v5L6 13" />
      <path d="M6 11l12 3v5L6 16" />
    </svg>
  )
}

const IDE_ICON_MAP: Record<IdeId, ({ size }: { size: number }) => React.ReactElement> = {
  vscode: ({ size }) => <IconBrandVscode size={size} />,
  cursor: CursorIcon,
  kiro: KiroIcon,
  intellij: IntelliJIcon,
  webstorm: WebStormIcon,
  zed: ZedIcon,
  sublime: SublimeIcon
}

export function IdeIcon({ ide, size = 16 }: IdeIconProps) {
  const Icon = IDE_ICON_MAP[ide]
  return <Icon size={size} />
}
