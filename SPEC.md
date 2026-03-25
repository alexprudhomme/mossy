# Git Worktree Visualizer — App Spec

## Problem

User works heavily with git worktrees. They create a worktree, make changes, commit, push, then delete the worktree. GitHub Desktop accumulates every worktree as a persistent repo entry, polluting the sidebar with 20+ stale entries that must be manually removed. There is no lightweight desktop tool that treats a repo as a **transient session** opened exclusively from the CLI.

## Proposed Solution

A minimal Electron app called **`gitpeek`** (working name). It is a single-purpose git visualizer: you open it from the terminal pointing at a directory, it shows you the changes, you commit and push, you close it. **No persistent repo list. No project switcher. No settings. No accounts.**

---

## Core Requirements

### R1 — CLI-only entry point
- The app is opened exclusively via CLI: `gitpeek .` or `gitpeek /path/to/worktree`
- If the app is already running and you run `gitpeek .` again from a different directory, it opens a **new window** for that directory
- No welcome screen, no "add repository" flow
- If launched with no argument or an invalid path (not a git repo), show an error message and exit

### R2 — Changed files list (left panel)
- Show a list of all changed files (staged + unstaged + untracked), similar to GitHub Desktop's left sidebar
- Each file shows its status icon: modified (M), added (A), deleted (D), renamed (R), untracked (?)
- Files are grouped by status: "Changes" (unstaged) and "Staged Changes"
- Clicking a file shows its diff in the right panel
- Checkbox next to each file to stage/unstage it (like GitHub Desktop)

### R3 — Diff viewer (right panel)
- Show a unified diff of the selected file
- Syntax highlighting for common languages (JS/TS, Python, Go, Rust, JSON, YAML, HTML, CSS, Markdown at minimum)
- Side-by-side or unified toggle (default: unified)
- Line numbers on both sides
- Green/red highlighting for additions/deletions

### R4 — Commit
- Text input at the bottom-left for commit summary (required) and optional description
- "Commit" button that commits all staged changes
- After commit, the changed files list refreshes automatically
- Show the current branch name prominently in the header

### R5 — Push
- "Push" button in the header/toolbar
- Shows push status (ahead/behind count)
- If there's no upstream, offer to set it (`git push -u origin <branch>`)
- Show a brief success/error notification after push

### R6 — No persistence
- The app does NOT maintain a list of repositories
- No config file storing previously opened repos
- No recent repos menu
- When all windows are closed, the app quits entirely
- Each window's title bar shows: `branch-name — folder-name`

### R7 — Auto-refresh
- Watch the `.git` directory (or worktree's gitdir) for changes
- Auto-refresh the file list when files change on disk (debounced, ~500ms)
- This means if the user makes changes in their editor, the app updates live

---

## Non-Requirements (explicitly out of scope)

- ❌ Repository list / project switcher
- ❌ GitHub/GitLab account integration or authentication
- ❌ Pull request creation or review
- ❌ Branch creation/switching/management
- ❌ Merge conflict resolution
- ❌ History/log viewer
- ❌ Blame view
- ❌ Settings/preferences UI
- ❌ Auto-update mechanism (for v1)
- ❌ Windows/Linux support (macOS-first for v1, but Electron makes cross-platform easy later)

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Electron** (latest stable) | Cross-platform desktop, user requested it |
| UI | **React 18+** with TypeScript | Fast to build, component model fits the layout |
| Styling | **Tailwind CSS** or plain CSS modules | Keep it simple, no heavy UI framework |
| Git operations | **simple-git** npm package | Well-maintained Node.js git wrapper, runs git CLI under the hood |
| Diff parsing | **diff2html** | Renders unified/side-by-side diffs with syntax highlighting out of the box |
| Syntax highlighting | Built into diff2html (uses highlight.js) | No extra dep needed |
| File watching | **chokidar** | Battle-tested file watcher for Node.js |
| Build/package | **electron-builder** | Standard Electron packaging, produces .dmg for macOS |
| Bundler | **Vite** with `electron-vite` or `vite-plugin-electron` | Fast dev experience, HMR |

---

## Architecture

```
gitpeek/
├── package.json
├── electron.vite.config.ts
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # App entry, CLI arg parsing, window management
│   │   ├── git.ts             # Git operations via simple-git (IPC handlers)
│   │   └── watcher.ts         # chokidar file watcher, sends refresh events to renderer
│   ├── preload/
│   │   └── index.ts           # Exposes IPC bridge to renderer (contextBridge)
│   └── renderer/              # React app
│       ├── index.html
│       ├── main.tsx           # React entry
│       ├── App.tsx            # Main layout: sidebar + diff viewer
│       ├── components/
│       │   ├── FileList.tsx       # Left panel: changed files with checkboxes
│       │   ├── FileListItem.tsx   # Single file row with status icon + checkbox
│       │   ├── DiffViewer.tsx     # Right panel: renders diff2html output
│       │   ├── CommitBox.tsx      # Bottom-left: summary input + commit button
│       │   ├── Toolbar.tsx        # Top bar: branch name, push button, ahead/behind
│       │   └── ErrorBanner.tsx    # Notification bar for push success/failure
│       ├── hooks/
│       │   ├── useGit.ts         # Hook wrapping IPC calls to main process
│       │   └── useFileWatcher.ts # Hook listening for refresh events from main
│       └── styles/
│           └── global.css        # Minimal styling, dark theme by default
├── resources/                 # App icon
└── build/                     # electron-builder output config
```

---

## IPC API (main ↔ renderer)

The renderer NEVER runs git directly. All git operations go through IPC to the main process.

| Channel | Direction | Payload | Response |
|---|---|---|---|
| `git:status` | renderer → main | — | `{ staged: FileEntry[], unstaged: FileEntry[], untracked: FileEntry[] }` |
| `git:diff` | renderer → main | `{ filePath: string, staged: boolean }` | `string` (raw unified diff) |
| `git:stage` | renderer → main | `{ filePaths: string[] }` | `void` |
| `git:unstage` | renderer → main | `{ filePaths: string[] }` | `void` |
| `git:commit` | renderer → main | `{ summary: string, description?: string }` | `{ success: boolean, error?: string }` |
| `git:push` | renderer → main | — | `{ success: boolean, error?: string }` |
| `git:branch-info` | renderer → main | — | `{ name: string, ahead: number, behind: number, hasUpstream: boolean }` |
| `git:push-set-upstream` | renderer → main | — | `{ success: boolean, error?: string }` |
| `files:changed` | main → renderer | — | (event, triggers re-fetch of status) |

**`FileEntry` type:**
```typescript
interface FileEntry {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
  oldPath?: string  // for renames
}
```

---

## CLI Behavior

The CLI entry is a shell script or binary symlink installed to `/usr/local/bin/gitpeek`.

```bash
# Usage
gitpeek [path]

# Examples
gitpeek .                    # Open current directory
gitpeek ~/dev/my-worktree    # Open specific path
gitpeek                      # Error: "Usage: gitpeek <path>"
gitpeek /not/a/git/repo      # Error: "Not a git repository"
```

**Implementation:** Use Electron's `app.requestSingleInstanceLock()` + `second-instance` event. If the app is already running, the new invocation sends the path to the existing process, which opens a new window. The path is passed via `process.argv`.

---

## UI Layout (ASCII wireframe)

```
┌─────────────────────────────────────────────────────────┐
│  ◉ main  ↑2 ↓0                          [Push]         │  ← Toolbar
├──────────────────┬──────────────────────────────────────┤
│ Changes (3)      │  src/components/App.tsx               │
│ ☑ src/App.tsx    │  ─────────────────────────────────── │
│ ☑ src/utils.ts   │  @@ -12,7 +12,9 @@                  │
│ ☐ README.md      │   import { useState } from 'react'   │
│                  │  -const old = true                    │  ← Diff viewer
│ Staged (1)       │  +const new = false                   │
│ ☑ package.json   │  +const extra = 42                    │
│                  │                                       │
│                  │                                       │
├──────────────────┤                                       │
│ Summary          │                                       │
│ [____________]   │                                       │
│ Description      │                                       │
│ [____________]   │                                       │
│ [Commit to main] │                                       │
└──────────────────┴──────────────────────────────────────┘
```

---

## Visual Design Notes

**The design should closely mirror GitHub Desktop's look and feel.** GitHub Desktop is the gold standard here — it's clean, simple, and familiar to the target user. The goal is that someone who uses GitHub Desktop would feel instantly at home in `gitpeek`, just without the extra features.

Specifically:
- **Match GitHub Desktop's layout exactly:** file list on the left, diff on the right, commit box bottom-left, toolbar across the top. Same proportions, same spacing.
- **Match GitHub Desktop's component styling:** the file list items, the checkboxes, the diff rendering, the commit input fields, the buttons — all should feel like they came from GitHub Desktop.
- **Match GitHub Desktop's colors and typography:** use the same dark theme palette, same font choices, same border/divider treatment, same hover/focus states.
- **Match GitHub Desktop's interaction patterns:** clicking a file highlights it and shows the diff, checking/unchecking stages/unstages, the commit button disables when summary is empty, etc.

Reference the actual GitHub Desktop app (or its source at `desktop/desktop` on GitHub) for exact colors, spacing, border radii, font sizes, and component structure. The renderer CSS in `app/styles/` and React components in `app/src/ui/` are the source of truth.

Specific design tokens (from GitHub Desktop):
- **Dark theme background:** #24292e (toolbar), #1e2228 (sidebar), #0d1117 (diff area)
- **Text:** #c9d1d9 (primary), #8b949e (secondary)
- **Diff colors:** #238636 / #164b25 (additions), #da3633 / #5d1214 (deletions)
- **Accent/buttons:** #2ea44f (primary green), #30363d (secondary)
- **Borders:** #30363d
- **Font:** -apple-system, BlinkMacSystemFont, "Segoe UI" (UI), monospace for diffs
- **Window size default:** 1200×800, resizable
- **Left panel width:** ~300px, resizable with drag handle
- **Border radius:** 6px for buttons and inputs (matching GitHub's design system)

---

## Key Implementation Details

### Worktree detection
Git worktrees have a `.git` **file** (not directory) pointing to the main repo's `.git/worktrees/<name>`. The `simple-git` library handles this transparently — just point it at the worktree directory and it works.

### File watching in worktrees
For worktrees, watch the worktree directory itself (not the main `.git` directory). Use chokidar on the worktree path, ignoring `node_modules`, `.git`, and other standard ignores. Also watch the `.git` file's target for index changes.

### Multiple windows
Each `BrowserWindow` is associated with a repo path. Store a `Map<BrowserWindow, string>` in the main process. When a window closes, remove it from the map. When the map is empty, quit the app.

### Packaging & CLI install
Use electron-builder to produce a `.dmg`. The CLI symlink can be installed via a post-install script or a menu option (like VS Code's "Install 'code' command in PATH"). The symlink points to the Electron app's binary:
```
/usr/local/bin/gitpeek → /Applications/GitPeek.app/Contents/MacOS/GitPeek
```

---

## Development Setup Commands

```bash
# Scaffold
mkdir gitpeek && cd gitpeek
npm init -y
npm install electron electron-vite react react-dom simple-git diff2html chokidar
npm install -D typescript @types/react @types/react-dom tailwindcss vite electron-builder

# Dev
npm run dev     # electron-vite dev with HMR

# Build
npm run build   # electron-builder, produces .dmg
```

---

## Todo Summary

1. **Project scaffold** — init repo, configure electron-vite, TypeScript, Tailwind
2. **Main process** — CLI arg parsing, window management, single-instance lock
3. **Git IPC layer** — all git operations as IPC handlers using simple-git
4. **File watcher** — chokidar setup, debounced refresh events
5. **Renderer: FileList** — left panel with staged/unstaged groups, checkboxes
6. **Renderer: DiffViewer** — right panel with diff2html rendering
7. **Renderer: CommitBox** — commit form with summary/description
8. **Renderer: Toolbar** — branch name, ahead/behind, push button
9. **Styling** — dark theme, layout, responsive panels
10. **Packaging** — electron-builder config, .dmg output, CLI symlink
