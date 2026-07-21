import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { IconAlertCircle } from '@tabler/icons-react'
import { useCreateJiraTicket } from '../hooks/useCreateJiraTicket'
import { validateForm, trimSummary, truncateTo255, isDirty, type FormState } from '../utils/jira-form-validation'
import { filterEpics } from '../utils/jira-epic-filter'

interface CreateJiraTicketFormProps {
  onClose: () => void
  onCreated: () => void
}

export function CreateJiraTicketForm({ onClose, onCreated }: CreateJiraTicketFormProps) {
  const {
    epics,
    epicsLoading,
    currentUser,
    currentUserError,
    projectKey,
    projectError,
    submit,
    submitting
  } = useCreateJiraTicket()

  // Form state
  const [summary, setSummary] = useState('')
  const [epicKey, setEpicKey] = useState<string | null>(null)
  const [epicSearch, setEpicSearch] = useState('')
  const [epicDropdownOpen, setEpicDropdownOpen] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Submission error banner
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Cancel confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Track default state for dirty detection
  const [defaults] = useState<FormState>({ summary: '', epicKey: null })

  // Ref for closing epic dropdown on outside click
  const epicDropdownRef = useRef<HTMLDivElement>(null)

  // Close epic dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (epicDropdownRef.current && !epicDropdownRef.current.contains(e.target as Node)) {
        setEpicDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const currentFormState: FormState = useMemo(() => ({
    summary,
    epicKey
  }), [summary, epicKey])

  const formIsDirty = isDirty(currentFormState, defaults)

  const hasBlockingError = !!(currentUserError || projectError)

  const filteredEpics = useMemo(() => filterEpics(epics, epicSearch), [epics, epicSearch])

  const charCount = useMemo(() => [...summary].length, [summary])

  // Clear field-level validation on field change once valid
  const handleSummaryChange = useCallback((value: string) => {
    const truncated = truncateTo255(value)
    setSummary(truncated)
    if (errors.summary && truncated.trim().length > 0) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.summary
        return next
      })
    }
  }, [errors.summary])

  const handleEpicSelect = useCallback((key: string | null) => {
    setEpicKey(key)
    setEpicSearch('')
    setEpicDropdownOpen(false)
  }, [])

  const handleCancel = useCallback(() => {
    if (formIsDirty) {
      setShowCancelConfirm(true)
    } else {
      onClose()
    }
  }, [formIsDirty, onClose])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleCancel])

  const handleConfirmCancel = useCallback(() => {
    setShowCancelConfirm(false)
    onClose()
  }, [onClose])

  const handleSubmit = useCallback(async () => {
    // Validate all fields
    const validationErrors = validateForm({ summary })
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitError(null)

    const trimmed = trimSummary(summary).replace(/[\n\r\t]/g, ' ')
    const result = await submit({
      issueType: 'User Story',
      summary: trimmed,
      epicKey: epicKey ?? undefined
    })

    if (result.success) {
      onCreated()
    } else {
      setSubmitError(result.error || 'Failed to create ticket')
    }
  }, [summary, epicKey, submit, onCreated])

  const selectedEpic = epics.find((e) => e.key === epicKey)

  return (
    <div className="flex flex-col min-h-[320px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <span id="create-jira-ticket-title" className="text-[10px] font-semibold text-[#484f58] uppercase tracking-wider">
          Create Jira Ticket
        </span>
      </div>

      {/* Form content */}
      <div className="flex-1 overflow-visible px-3 pb-3">
        <div className="flex flex-col gap-3">
          {/* Error banner */}
          {submitError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md px-3 py-2 text-xs flex items-start gap-2">
              <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Blocking errors */}
          {currentUserError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md px-2 py-1.5 text-[11px]">
              Could not determine Jira user: {currentUserError}
            </div>
          )}
          {projectError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md px-2 py-1.5 text-[11px]">
              Jira project not configured: {projectError}
            </div>
          )}

          {/* Read-only info: project + assignee */}
          <div className="flex flex-col gap-1">
            <div className="text-[10px] text-[#484f58]">
              Project: <span className="text-foreground">{projectKey ?? (projectError ? '—' : '...')}</span>
            </div>
            <div className="text-[10px] text-[#484f58]">
              Assignee: <span className="text-foreground">{currentUser ?? (currentUserError ? '—' : '...')}</span>
            </div>
          </div>

          {/* Summary input */}
          <div>
            <label className="block text-[10px] font-medium text-[#484f58] mb-1">Summary</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => handleSummaryChange(e.target.value)}
              maxLength={510}
              placeholder="Enter ticket summary..."
              disabled={submitting}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full bg-background border border-input rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between mt-0.5">
              {errors.summary ? (
                <p className="text-[10px] text-destructive">{errors.summary}</p>
              ) : (
                <span />
              )}
              {charCount >= 255 && (
                <span className="text-[10px] text-[#484f58]">{charCount}/255</span>
              )}
            </div>
          </div>

          {/* Parent Epic searchable dropdown */}
          <div ref={epicDropdownRef}>
            <label className="block text-[10px] font-medium text-[#484f58] mb-1">Parent Epic (optional)</label>
            {epicsLoading ? (
              <div className="flex items-center gap-2 py-1.5 text-[11px] text-muted-foreground">
                <span className="animate-spin h-3 w-3 border border-muted-foreground border-t-transparent rounded-full" />
                Loading epics...
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={epicDropdownOpen ? epicSearch : (selectedEpic ? `${selectedEpic.key} ${selectedEpic.summary}` : '')}
                  onChange={(e) => {
                    setEpicSearch(e.target.value)
                    if (!epicDropdownOpen) setEpicDropdownOpen(true)
                  }}
                  onFocus={() => setEpicDropdownOpen(true)}
                  placeholder="Search epics..."
                  disabled={submitting}
                  className="w-full bg-background border border-input rounded-md px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {selectedEpic && !epicDropdownOpen && (
                  <button
                    type="button"
                    onClick={() => handleEpicSelect(null)}
                    disabled={submitting}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs disabled:opacity-50"
                    aria-label="Clear epic selection"
                  >
                    &times;
                  </button>
                )}
                {epicDropdownOpen && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-background border border-input rounded-md max-h-32 overflow-auto shadow-md">
                    {filteredEpics.length === 0 ? (
                      <div className="px-2 py-1.5 text-[11px] text-[#484f58]">No matching epics</div>
                    ) : (
                      filteredEpics.map((epic) => (
                        <button
                          key={epic.key}
                          type="button"
                          className="w-full text-left px-2 py-1.5 text-[11px] hover:bg-accent transition-colors text-foreground truncate"
                          onClick={() => handleEpicSelect(epic.key)}
                        >
                          <span className="font-medium">{epic.key}</span>{' '}
                          <span className="text-muted-foreground">{epic.summary}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cancel confirmation prompt */}
          {showCancelConfirm && (
            <div className="bg-primary/10 border border-primary/30 rounded-md px-3 py-2 text-xs text-foreground">
              <p className="mb-2">You have unsaved changes. Discard and close?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-2 py-1 rounded text-[11px] bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  onClick={handleConfirmCancel}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Keep editing
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex justify-end gap-2 px-3 py-2 shrink-0 border-t border-border">
        <button
          type="button"
          className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSubmit}
          disabled={submitting || hasBlockingError}
        >
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <span className="animate-spin h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full" />
              Creating...
            </span>
          ) : (
            'Create'
          )}
        </button>
      </div>
    </div>
  )
}
