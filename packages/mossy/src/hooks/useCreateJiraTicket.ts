import { useState, useEffect, useCallback } from 'react'
import { rpc } from '../rpc'
import type { JiraEpic, CreateJiraIssueParams, CreateJiraIssueResult } from '../shared/types'

export function useCreateJiraTicket() {
  const [epics, setEpics] = useState<JiraEpic[]>([])
  const [epicsLoading, setEpicsLoading] = useState(true)

  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [currentUserError, setCurrentUserError] = useState<string | null>(null)

  const [projectKey, setProjectKey] = useState<string | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function fetchMetadata() {
      const [epicsRes, meRes, projectRes] = await Promise.all([
        rpc().request['jira:epics']({}),
        rpc().request['jira:me']({}),
        rpc().request['jira:project']({})
      ])

      if ('error' in epicsRes) {
        setEpics([])
      } else {
        setEpics(epicsRes.epics)
      }
      setEpicsLoading(false)

      if ('error' in meRes) {
        setCurrentUserError(meRes.error)
      } else {
        setCurrentUser(meRes.user)
      }

      if ('error' in projectRes) {
        setProjectError(projectRes.error)
      } else {
        setProjectKey(projectRes.projectKey)
      }
    }

    fetchMetadata()
  }, [])

  const submit = useCallback(async (params: CreateJiraIssueParams): Promise<CreateJiraIssueResult> => {
    setSubmitting(true)
    try {
      const result = await rpc().request['jira:createIssue'](params)
      return result
    } finally {
      setSubmitting(false)
    }
  }, [])

  return {
    epics,
    epicsLoading,
    currentUser,
    currentUserError,
    projectKey,
    projectError,
    submit,
    submitting
  }
}
