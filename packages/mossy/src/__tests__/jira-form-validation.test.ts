import { describe, test, expect } from 'bun:test'
import fc from 'fast-check'
import {
  validateSummary,
  trimSummary,
  truncateTo255,
  validateForm,
  isDirty,
  FormState,
} from '../utils/jira-form-validation'

describe('validateSummary', () => {
  test('returns null for a valid summary', () => {
    expect(validateSummary('Fix login bug')).toBeNull()
  })

  test('returns error for empty string', () => {
    expect(validateSummary('')).toBe('Summary is required')
  })

  test('returns error for whitespace-only string', () => {
    expect(validateSummary('   ')).toBe('Summary is required')
    expect(validateSummary('\t\n')).toBe('Summary is required')
  })

  test('returns null for exactly 255 characters', () => {
    const str = 'a'.repeat(255)
    expect(validateSummary(str)).toBeNull()
  })

  test('returns error for more than 255 characters', () => {
    const str = 'a'.repeat(256)
    expect(validateSummary(str)).toBe('Summary must not exceed 255 characters')
  })

  test('counts Unicode characters correctly, not bytes', () => {
    // Emoji is one character but multiple bytes
    const str = '🎉'.repeat(255)
    expect(validateSummary(str)).toBeNull()

    const tooLong = '🎉'.repeat(256)
    expect(validateSummary(tooLong)).toBe('Summary must not exceed 255 characters')
  })
})

describe('trimSummary', () => {
  test('strips leading whitespace', () => {
    expect(trimSummary('  hello')).toBe('hello')
  })

  test('strips trailing whitespace', () => {
    expect(trimSummary('hello  ')).toBe('hello')
  })

  test('strips both leading and trailing whitespace', () => {
    expect(trimSummary('  hello  ')).toBe('hello')
  })

  test('preserves internal whitespace', () => {
    expect(trimSummary('  hello world  ')).toBe('hello world')
  })

  test('returns empty string for whitespace-only input', () => {
    expect(trimSummary('   ')).toBe('')
  })
})

describe('truncateTo255', () => {
  test('returns the same string when <= 255 characters', () => {
    const str = 'short string'
    expect(truncateTo255(str)).toBe(str)
  })

  test('returns the same string when exactly 255 characters', () => {
    const str = 'x'.repeat(255)
    expect(truncateTo255(str)).toBe(str)
  })

  test('truncates to 255 characters when longer', () => {
    const str = 'a'.repeat(300)
    const result = truncateTo255(str)
    expect([...result].length).toBe(255)
  })

  test('handles multi-byte Unicode characters correctly', () => {
    // 256 emoji characters, each is multi-byte
    const str = '🎉'.repeat(256)
    const result = truncateTo255(str)
    expect([...result].length).toBe(255)
    // Ensure no broken surrogate pairs
    expect(result).toBe('🎉'.repeat(255))
  })
})

describe('validateForm', () => {
  test('returns empty record when summary is valid', () => {
    const result = validateForm({ summary: 'My ticket' })
    expect(result).toEqual({})
  })

  test('returns summary error when summary is empty', () => {
    const result = validateForm({ summary: '' })
    expect(result).toEqual({ summary: 'Summary is required' })
  })

  test('returns summary length error for over-length summary', () => {
    const result = validateForm({ summary: 'a'.repeat(256) })
    expect(result).toEqual({ summary: 'Summary must not exceed 255 characters' })
  })
})

describe('isDirty', () => {
  const defaults: FormState = {
    summary: '',
    epicKey: null,
  }

  test('returns false when current equals defaults', () => {
    const current: FormState = { ...defaults }
    expect(isDirty(current, defaults)).toBe(false)
  })

  test('returns true when summary differs', () => {
    const current: FormState = { ...defaults, summary: 'New ticket' }
    expect(isDirty(current, defaults)).toBe(true)
  })

  test('returns true when epicKey differs', () => {
    const current: FormState = { ...defaults, epicKey: 'PROJ-100' }
    expect(isDirty(current, defaults)).toBe(true)
  })

  test('returns false when both have null epicKey', () => {
    const current: FormState = { summary: '', epicKey: null }
    expect(isDirty(current, defaults)).toBe(false)
  })
})

/**
 * Feature: jira-ticket-creation, Property 2: Summary length enforcement
 * Validates: Requirements 4.3, 4.5
 */

describe('Property 2: Summary length enforcement', () => {
  test('validateSummary rejects any string longer than 255 characters', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 256, maxLength: 500 }), (longString) => {
        const result = validateSummary(longString)
        return result !== null && result.length > 0
      }),
      { numRuns: 100 }
    )
  })

  test('truncateTo255 always returns a string of 255 or fewer characters', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 256, maxLength: 500 }), (longString) => {
        const result = truncateTo255(longString)
        return [...result].length <= 255
      }),
      { numRuns: 100 }
    )
  })
})

describe('Feature: jira-ticket-creation, Property 3: Summary whitespace trimming', () => {
  /**
   * **Validates: Requirements 4.4**
   *
   * For any valid summary string (non-empty, non-whitespace-only, ≤255 chars)
   * with arbitrary leading/trailing whitespace added, trimSummary(value) should
   * equal the original string with leading and trailing whitespace removed (i.e., value.trim()).
   */
  test('trimSummary(value) equals value.trim() for any valid summary with arbitrary surrounding whitespace', () => {
    const summaryWithWhitespace = fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        fc.string({ unit: fc.constantFrom(' ', '\t', '\n') }),
        fc.string({ unit: fc.constantFrom(' ', '\t', '\n') })
      )
      .map(([s, before, after]) => before + s + after)

    fc.assert(
      fc.property(summaryWithWhitespace, (value) => {
        const result = trimSummary(value)
        expect(result).toBe(value.trim())
      }),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: jira-ticket-creation, Property 1: Whitespace-only summaries are always rejected
 * Validates: Requirements 4.2, 8.1
 */
describe('Property Tests - Form Validation', () => {
  test('Property 1: Whitespace-only summaries are always rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom(' ', '\t', '\n', '\r') }),
        (whitespaceStr) => {
          const result = validateSummary(whitespaceStr)
          expect(result).not.toBeNull()
          expect(typeof result).toBe('string')
        }
      ),
      { numRuns: 100 }
    )
  })
})


/**
 * Feature: jira-ticket-creation, Property 5: Validation displays all errors simultaneously
 * Validates: Requirements 8.3
 *
 * Since we only have one validatable field (summary), this property verifies
 * that validateForm correctly reports the summary error when invalid.
 */
describe('Property 5: Validation reports summary error when invalid', () => {
  test('validateForm reports summary error for any invalid summary', () => {
    const invalidSummaries = fc.oneof(
      fc.constant(''),
      fc.string({ unit: fc.constantFrom(' ', '\t', '\n') }),
      fc.string({ minLength: 256, maxLength: 500 })
    )

    fc.assert(
      fc.property(invalidSummaries, (summary) => {
        const result = validateForm({ summary })

        // Check that the individually-invalid field produces an error in the combined result
        const summaryError = validateSummary(summary)

        if (summaryError !== null) {
          expect(result.summary).toBeDefined()
          expect(result.summary).toBe(summaryError)
        }
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Feature: jira-ticket-creation, Property 6: Dirty-state detection for cancel confirmation
 * **Validates: Requirements 2.3, 2.4**
 */
describe('Property 6: Dirty-state detection for cancel confirmation', () => {
  const defaultsArb = fc.record({
    summary: fc.string(),
    epicKey: fc.oneof(fc.string(), fc.constant(null)),
  })

  test('isDirty returns false when current equals defaults (same state → not dirty)', () => {
    fc.assert(
      fc.property(defaultsArb, (defaults) => {
        expect(isDirty(defaults, defaults)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  test('isDirty returns true when at least one field differs from defaults', () => {
    // Generate defaults and a modified state that differs in at least one field
    const modifiedArb = fc
      .tuple(
        defaultsArb,
        fc.record({
          summary: fc.string(),
          epicKey: fc.oneof(fc.string(), fc.constant(null)),
        }),
        // Which fields to modify (at least one must be true)
        fc.tuple(fc.boolean(), fc.boolean()).filter(
          ([a, b]) => a || b
        )
      )
      .map(([defaults, candidate, [modSummary, modEpicKey]]) => {
        const modified: FormState = { ...defaults }

        if (modSummary) {
          // Ensure summary differs from defaults
          modified.summary =
            candidate.summary !== defaults.summary
              ? candidate.summary
              : defaults.summary + '_changed'
        }
        if (modEpicKey) {
          // Ensure epicKey differs from defaults
          if (candidate.epicKey !== defaults.epicKey) {
            modified.epicKey = candidate.epicKey
          } else {
            modified.epicKey = defaults.epicKey === null ? 'EPIC-1' : null
          }
        }

        return { defaults, modified }
      })

    fc.assert(
      fc.property(modifiedArb, ({ defaults, modified }) => {
        expect(isDirty(modified, defaults)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
