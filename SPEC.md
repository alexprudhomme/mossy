# Mossy — Git Worktree Management Dashboard

## Overview

**Mossy** is a macOS desktop app for managing git worktrees across multiple repositories. It provides a dashboard view of all your repos and their worktrees, with integrated issue tracking (Jira or GitHub Issues), PR status badges, and an inline diff viewer for staging, committing, and pushing changes — all without leaving the app.

---

## Key Features

- **Multi-repo worktree dashboard** — Configure repos, view all worktrees at a glance
- **Inline diff viewer** — Expand any worktree card to see changes, stage/unstage files, commit, and push
- **Pluggable issue tracker** — Jira, GitHub Issues, or None (global setting)
- **PR & CI badges** — See PR status and CI results on each worktree card
- **Issue drag-to-create** — Drag an issue from the sidebar onto a repo to create a worktree with the issue key as branch name
- **Configurable worktree path** — Single global base path for all worktrees (e.g. `~/Developer/worktrees`)
- **IDE & terminal launching** — Open any worktree in your preferred editor or Ghostty terminal

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Electrobun** (Bun-based native desktop) |
| UI | **React 18** + TypeScript |
| Styling | **Tailwind CSS v4** (dark theme) |
| Build | **Vite** |
| Git operations | **Bun.spawn** (raw git CLI) |
| CLI integrations | `gh` (GitHub), `jira` (Jira CLI) |
| Drag & drop | **@dnd-kit** |
| Package manager | **pnpm** (monorepo), **Bun** (runtime) |

---

## Architecture

```
packages/mossy/
├── src/
│   ├── bun/                        # Main process (Bun runtime)
│   │   ├── index.ts                # Entry, RPC handlers, window, menu, auto-update
│   │   └── services/
│   │       ├── git.ts              # Worktree mgmt + diff/stage/commit/push
│   │       ├── github.ts           # PR info via gh CLI
│   │       ├── github-issues.ts    # GitHub Issues via gh CLI
│   │       ├── jira.ts             # Jira issues via jira CLI
│   │       ├── issue-dispatcher.ts # Routes to jira/github/none based on config
│   │       ├── config.ts           # JSON config at ~/.config/mossy/
│   │       ├── launcher.ts         # IDE + terminal launching
│   │       ├── dependencies.ts     # CLI health checks
│   │       └── shell-env.ts        # Login shell env resolution
│   ├── components/
│   │   ├── App.tsx                 # Main app: header, dashboard, issue sidebar, settings
│   │   ├── RepoDashboard.tsx       # Multi-repo sortable view
│   │   ├── WorktreeCard.tsx        # Worktree with badges + expandable diff
│   │   ├── DiffPanel.tsx           # Inline diff: file list, diff viewer, commit box
│   │   ├── SettingsModal.tsx       # Config UI (repos, IDE, tracker, worktree path)
│   │   ├── AddWorktreeModal.tsx    # New/existing branch worktree creation
│   │   ├── DeleteWorktreeModal.tsx # Safe deletion with status checks
│   │   ├── IssuePanel.tsx          # Sidebar: Jira or GitHub Issues
│   │   ├── IssueCard.tsx           # Draggable issue card
│   │   ├── PRBadge.tsx             # PR state + CI badge
│   │   ├── IssueBadge.tsx          # Issue status badge (generic)
│   │   ├── DirtyBadge.tsx          # Dirty/ahead/behind indicator
│   │   ├── LaunchButtons.tsx       # IDE + Ghostty buttons
│   │   └── IdeIcon.tsx             # Custom SVG IDE icons
│   ├── hooks/                      # React hooks for all data fetching
│   ├── shared/                     # Types, RPC schema, IDE registry
│   ├── lib/                        # Diff parser
│   ├── mainview/                   # Electrobun entry point
│   ├── browser-dev/                # Vite dev mode (no Electrobun)
│   └── styles/
│       └── global.css              # Tailwind v4 + dark theme vars
```

---

## Configuration

**Location:** `~/.config/mossy/mossy-config.json`

Key settings:
- `repositories` — List of repos with name, path, and setup commands
- `worktreeBasePath` — Global base path for worktrees (default: `~/Developer/worktrees`)
- `issueTracker` — `'jira'` | `'github'` | `'none'`
- `defaultIde` — `'vscode'` | `'cursor'` | `'intellij'` | `'webstorm'` | `'zed'` | `'sublime'`
- `pollIntervalSec` / `fetchIntervalSec` — Refresh intervals
- `issuePanelOpen` / `issuePanelWidth` — Issue sidebar state

Worktrees are created at: `<worktreeBasePath>/<repo-slug>/<branch-name>`
