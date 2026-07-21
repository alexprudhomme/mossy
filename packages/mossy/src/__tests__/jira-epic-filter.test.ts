import { describe, test, expect } from 'bun:test'
import fc from 'fast-check'
import { filterEpics } from '../utils/jira-epic-filter'
import { JiraEpic } from '../shared/types'

/**
 * Feature: jira-ticket-creation, Property 4: Epic filter correctness
 * Validates: Requirements 5.5
 *
 * For any list of epics and any search query string, the filtered result should:
 * 1. Contain ONLY epics where key or summary contains the query as a case-insensitive substring
 * 2. Contain ALL such epics (no false negatives)
 */
describe('Feature: jira-ticket-creation, Property 4: Epic filter correctness', () => {
  const epicArb = fc.record({
    key: fc.string({ minLength: 1 }),
    summary: fc.string(),
  })
  const epicsArb = fc.array(epicArb)
  const queryArb = fc.string()

  test('filtered result contains ONLY epics matching the query (no false positives)', () => {
    fc.assert(
      fc.property(epicsArb, queryArb, (epics: JiraEpic[], query: string) => {
        const result = filterEpics(epics, query)
        const lowerQuery = query.toLowerCase()

        for (const epic of result) {
          const keyMatches = epic.key.toLowerCase().includes(lowerQuery)
          const summaryMatches = epic.summary.toLowerCase().includes(lowerQuery)
          expect(keyMatches || summaryMatches).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  test('filtered result contains ALL matching epics (no false negatives)', () => {
    fc.assert(
      fc.property(epicsArb, queryArb, (epics: JiraEpic[], query: string) => {
        const result = filterEpics(epics, query)
        const lowerQuery = query.toLowerCase()

        for (const epic of epics) {
          const keyMatches = epic.key.toLowerCase().includes(lowerQuery)
          const summaryMatches = epic.summary.toLowerCase().includes(lowerQuery)
          if (keyMatches || summaryMatches) {
            expect(result).toContainEqual(epic)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  test('empty query returns all epics', () => {
    fc.assert(
      fc.property(epicsArb, (epics: JiraEpic[]) => {
        const result = filterEpics(epics, '')
        expect(result).toEqual(epics)
      }),
      { numRuns: 100 }
    )
  })
})
