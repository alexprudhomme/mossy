import { useState, useEffect, useCallback } from 'react'
import { rpc } from '../rpc'
import type { AppConfig, IdeId, IssueTracker, RepoConfig } from '../shared/types'

export function useConfig() {
  const [config, setConfigState] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const cfg = await rpc().request['config:get']({})
    setConfigState(cfg)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(async (cfg: AppConfig) => {
    await rpc().request['config:set']({ config: cfg })
    setConfigState(cfg)
  }, [])

  const addRepo = useCallback(
    async (name: string, path: string) => {
      if (!config) return
      const newRepo: RepoConfig = {
        id: crypto.randomUUID(),
        name,
        path
      }
      const updated = { ...config, repositories: [...config.repositories, newRepo] }
      await save(updated)
    },
    [config, save]
  )

  const removeRepo = useCallback(
    async (id: string) => {
      if (!config) return
      const updated = { ...config, repositories: config.repositories.filter((r) => r.id !== id) }
      await save(updated)
    },
    [config, save]
  )

  const setPollInterval = useCallback(
    async (sec: number) => {
      if (!config) return
      await save({ ...config, pollIntervalSec: sec })
    },
    [config, save]
  )

  const setAutoUpdateEnabled = useCallback(
    async (enabled: boolean) => {
      if (!config) return
      await save({ ...config, autoUpdateEnabled: enabled })
    },
    [config, save]
  )

  const setUpdateCheckInterval = useCallback(
    async (minutes: number) => {
      if (!config) return
      await save({ ...config, updateCheckIntervalMin: minutes })
    },
    [config, save]
  )

  const reorderRepos = useCallback(
    async (repositories: RepoConfig[]) => {
      if (!config) return
      await save({ ...config, repositories })
    },
    [config, save]
  )

  const setDefaultIde = useCallback(
    async (ide: IdeId) => {
      if (!config) return
      await save({ ...config, defaultIde: ide })
    },
    [config, save]
  )

  const setRepoSetupCommands = useCallback(
    async (repoId: string, commands: string[]) => {
      if (!config) return
      const updated = {
        ...config,
        repositories: config.repositories.map((r) =>
          r.id === repoId ? { ...r, setupCommands: commands.length ? commands : undefined } : r
        )
      }
      await save(updated)
    },
    [config, save]
  )

  const setIssuePanelOpen = useCallback(
    async (open: boolean) => {
      if (!config) return
      await save({ ...config, issuePanelOpen: open })
    },
    [config, save]
  )

  const setIssuePanelWidth = useCallback(
    async (width: number) => {
      if (!config) return
      await save({ ...config, issuePanelWidth: width })
    },
    [config, save]
  )

  const setIssueTracker = useCallback(
    async (tracker: IssueTracker) => {
      if (!config) return
      await save({ ...config, issueTracker: tracker })
    },
    [config, save]
  )

  const setFetchInterval = useCallback(
    async (sec: number) => {
      if (!config) return
      await save({ ...config, fetchIntervalSec: sec })
    },
    [config, save]
  )

  const setWorktreeBasePath = useCallback(
    async (basePath: string) => {
      if (!config) return
      await save({ ...config, worktreeBasePath: basePath })
    },
    [config, save]
  )

  return {
    config,
    loading,
    save,
    addRepo,
    removeRepo,
    setPollInterval,
    setAutoUpdateEnabled,
    setUpdateCheckInterval,
    reorderRepos,
    setDefaultIde,
    setRepoSetupCommands,
    setIssuePanelOpen,
    setIssuePanelWidth,
    setFetchInterval,
    setIssueTracker,
    setWorktreeBasePath
  }
}
