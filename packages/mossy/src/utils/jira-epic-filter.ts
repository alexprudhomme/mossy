import type { JiraEpic } from '../shared/types'

/**
 * Filters a list of Jira epics by performing a case-insensitive substring match
 * against both the epic key and the epic summary.
 *
 * @param epics - The list of epics to filter
 * @param query - The search query string
 * @returns All epics where the key or summary contains the query as a substring.
 *          If query is empty, all epics are returned.
 */
export function filterEpics(epics: JiraEpic[], query: string): JiraEpic[] {
  if (query === '') {
    return epics
  }

  const lowerQuery = query.toLowerCase()

  return epics.filter(
    (epic) =>
      epic.key.toLowerCase().includes(lowerQuery) ||
      epic.summary.toLowerCase().includes(lowerQuery)
  )
}
