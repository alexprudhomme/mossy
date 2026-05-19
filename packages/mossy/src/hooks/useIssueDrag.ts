export interface IssueDragData {
  issueKey: string
  issueSummary: string
}

/** Prefix used for dnd-kit draggable IDs representing issues */
export const ISSUE_DRAG_PREFIX = 'issue::'

/** Prefix used for dnd-kit droppable IDs representing repo drop targets */
export const REPO_DROP_PREFIX = 'repo-drop::'

export function makeIssueDragId(issueKey: string): string {
  return `${ISSUE_DRAG_PREFIX}${issueKey}`
}

export function makeRepoDropId(repoId: string): string {
  return `${REPO_DROP_PREFIX}${repoId}`
}

export function isIssueDragId(id: string): boolean {
  return id.startsWith(ISSUE_DRAG_PREFIX)
}

export function isRepoDropId(id: string): boolean {
  return id.startsWith(REPO_DROP_PREFIX)
}

export function extractRepoIdFromDropId(id: string): string {
  return id.slice(REPO_DROP_PREFIX.length)
}
