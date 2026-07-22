/**
 * Pure utility functions for Jira ticket creation form validation.
 * No React dependencies or side effects.
 */

export interface FormState {
  summary: string
  epicKey: string | null
}

/**
 * Validates the summary field value.
 * Returns null if valid, or an error message string if invalid.
 *
 * Checks:
 * - Empty or whitespace-only strings are rejected
 * - Strings exceeding 255 UTF-8 characters are rejected
 */
export function validateSummary(value: string): string | null {
  if (value.trim().length === 0) {
    return 'Summary is required'
  }

  if ([...value].length > 255) {
    return 'Summary must not exceed 255 characters'
  }

  return null
}

/**
 * Strips leading and trailing whitespace from a summary value.
 */
export function trimSummary(value: string): string {
  return value.trim()
}

/**
 * Truncates a string to at most 255 UTF-8 characters.
 * Uses spread operator to correctly handle multi-byte Unicode characters.
 */
export function truncateTo255(value: string): string {
  const chars = [...value]
  if (chars.length <= 255) {
    return value
  }
  return chars.slice(0, 255).join('')
}

/**
 * Validates all form fields simultaneously, returning a record of field names
 * to error messages. Only fields with errors are included in the result.
 */
export function validateForm(fields: {
  summary: string
}): Record<string, string> {
  const errors: Record<string, string> = {}

  const summaryError = validateSummary(fields.summary)
  if (summaryError !== null) {
    errors.summary = summaryError
  }

  return errors
}

/**
 * Checks if the current form state differs from the default state.
 * Returns true if any field has been modified.
 */
export function isDirty(current: FormState, defaults: FormState): boolean {
  return (
    current.summary !== defaults.summary ||
    current.epicKey !== defaults.epicKey
  )
}
