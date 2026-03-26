import React from 'react'
import { BranchInfo } from '../shared/types'

interface ToolbarProps {
  branchInfo: BranchInfo | null
  onPush: () => void
}

export function Toolbar({ branchInfo, onPush }: ToolbarProps): React.ReactElement {
  const name = branchInfo?.name || '—'
  const ahead = branchInfo?.ahead || 0
  const behind = branchInfo?.behind || 0

  return (
    <div id="desktop-app-title-bar" className="electrobun-webkit-app-region-drag">
      <div className="toolbar-content electrobun-webkit-app-region-no-drag">
        <div className="toolbar-section sidebar-section">
          <div className="branch-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
              />
            </svg>
          </div>
          <span className="branch-name">{name}</span>
          {(ahead > 0 || behind > 0) && (
            <span className="ahead-behind">
              {ahead > 0 && <span>↑{ahead}</span>}
              {behind > 0 && <span>↓{behind}</span>}
            </span>
          )}
        </div>
        <div className="toolbar-section push-section">
          <button
            className="push-btn"
            onClick={onPush}
            title={
              branchInfo && !branchInfo.hasUpstream
                ? 'Publish branch'
                : 'Push to remote'
            }
          >
            {branchInfo && !branchInfo.hasUpstream ? 'Publish branch' : 'Push origin'}
            {ahead > 0 && (
              <span className="push-badge">{ahead}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
