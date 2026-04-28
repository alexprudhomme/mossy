# mossy

## 0.7.0

### Minor Changes

- ac801af: Add sparkly rainbow styling to the "Merged" status badge on Jira tickets, matching the animation treatment used for approved PRs.

## 0.6.1

### Patch Changes

- 672219c: Set iTerm2 tab name to the worktree/branch name when opening a terminal tab, instead of the default "zsh" label.

## 0.6.0

### Minor Changes

- ea73ea0: Add iTerm2 terminal support with a terminal switcher in settings. Users can now choose between Ghostty, iTerm2, and Terminal.app as their default terminal. The terminal button in worktree cards dynamically reflects the selected terminal with its own icon.

### Patch Changes

- e97dc79: Add a pull button next to the IDE and terminal buttons in the repo header to update the main project repository.

## 0.5.2

### Patch Changes

- 2c0e238: Fix approved pill not showing for repos without required review branch protection. Falls back to computing review decision from individual reviews when the API field is empty.

## 0.5.1

### Patch Changes

- e4ec3b2: Hide the collapse/expand arrow for projects with zero worktrees, since clicking it had no effect.

## 0.5.0

### Minor Changes

- 792f2f2: Move the main repo branch out of the worktree list and into the project header. The repo header now displays the current branch name alongside VSCode and Ghostty launch buttons, keeping the worktree list focused on feature branches only.
- 53ae14a: Add ability to mark worktrees as "not ready" — a toggle button on each worktree card dims the card and shows a yellow "not ready" badge, persisted in config.

### Patch Changes

- 0e82ff6: Add blue hover color to VS Code launch icon, matching the hover color pattern used by other IDE icons.
- 299c432: Differentiate draft PRs from open PRs by color. Open PRs now use emerald (green) and draft PRs use slate (gray), making it easy to tell them apart at a glance.
- 2383f65: Make the 'Approved' review badge a rainbow-animated sparkly pill instead of plain green.
- 51421c6: Redesign worktree card status badges: Jira label now shows only the ticket key in blue, review badge only appears when PR is approved, and badge ordering is Dirty (left) → Review → PR → Conflicts → Jira (right).

## 0.4.0

### Minor Changes

- b45fe8d: Add drag-and-drop reordering for worktrees within each repo section, matching the existing repo reorder UX.

## 0.3.0

### Minor Changes

- ab4b8e6: Add CMD+/CMD- zoom controls to scale the UI bigger or smaller. Zoom level persists across sessions. CMD+0 resets to default. Also adds a View menu with Zoom In, Zoom Out, and Actual Size items.

### Patch Changes

- c559875: Fix double-clicking the title bar to zoom the window (macOS native behavior) instead of selecting text.
- 8e432e7: Remove unused filter worktrees functionality from the header bar.

## 0.2.6

### Patch Changes

- 40c6253: Exclude Epic issue types from the Jira issues panel.

## 0.2.5

### Patch Changes

- cec274d: Add custom app icon using Ghostty-inspired color palette (coral pink on dark navy).

## 0.2.4

### Patch Changes

- 20008a6: Fix update check silently reporting "You are on the latest version" when the check actually failed.

  `Updater.checkForUpdate()` returns an error string when the update manifest can't be fetched (e.g. network issue or missing release asset), but `checkForAppUpdate()` was ignoring `info.error` and returning `success: true`. The UI then showed "You are on the latest version." instead of the actual error.

  Both layers are now fixed: the backend propagates the error from the Electrobun Updater, and the UI checks `result.success` before deciding which message to display.

## 0.2.3

### Patch Changes

- ed031f3: Make the missing dependency yellow warning dismissible with an × button.
- 571680f: Remove the staged/unstaged split in the diff panel file list. All changed files now appear in a single unified list; the checkbox is the sole indicator of whether a file is staged. Checking/unchecking still stages or unstages the file but files no longer jump between sections.
- a94d47a: Fix worktree diff line counts excluding untracked files. Previously, `+N -N` stats only counted tracked file changes via `git diff --numstat HEAD`, so new files that hadn't been staged yet were completely invisible. Now untracked files are discovered with `git ls-files --others --exclude-standard` and their line counts are added to the total.

## 0.2.2

### Patch Changes

- 1f7d83a: Fix update check by syncing electrobun.config version with package.json, and display the current app version in the Updates settings section.

## 0.2.1

### Patch Changes

- 081530f: Fix merge queue indicator by using GraphQL API to detect merge queue status instead of the unreliable `mergeStateStatus` field from `gh pr view`.

## 0.2.0

### Minor Changes

- 9896e8d: Add merge conflicts indicator badge to worktree cards. Each non-main branch now shows an orange badge when it has merge conflicts with the target branch (e.g. `main`), including the count and list of conflicting files in the tooltip. Uses `git merge-tree --write-tree` for non-destructive conflict detection with 60s result caching.
- cb929ec: Add PR review status indicator to the PR badge. Shows approval state (Approved, Changes requested, Review required) as a color-coded badge next to the existing PR and CI badges. Fetches the `reviewDecision` field from the GitHub API via `gh pr view`.

### Patch Changes

- fd563eb: Fix "check for updates" button: corrected RPC method name from `system:checkForUpdates` to `app:checkForUpdates` and fixed response property access from `result.available` to `result.updateAvailable`.
- a173512: Jira indicator now prefers the issue key from the PR description over the branch name. When a PR exists, the issue key is extracted from its body; when no PR exists, falls back to the branch name. Shows nothing if no issue key is found in either source.
- c7ef136: Show "merge queue" indicator instead of "open" when a PR is queued in the merge queue.
- 43da431: Reduced commit success toast duration from 3s to ~1s with a smooth fade-out, and made it non-blocking so the push button is always clickable.
- 190eeff: Remove double-click to open IDE on worktree cards. The IDE can still be launched via the launch buttons.

## 0.1.2

### Patch Changes

- 7b5c945: Disable macOS code signing for unsigned .dmg builds. Users can force-open the app via System Settings.

## 0.1.1

### Patch Changes

- ff290d7: Fix release workflow to produce signed .dmg artifacts.

  - Fix package name references (gitpeek → mossy) and artifact paths (build/ → artifacts/)
  - Add macOS code signing setup (Apple certificate chain + keychain) matching treebeard's approach
  - Enable codesign in electrobun config
  - Add release baseUrl for future auto-update support
  - Upload .dmg, .tar.zst, and update.json to GitHub Releases

- 1baa6ef: Rename all gitpeek references to mossy after GitHub repo rename.

## 0.1.0

### Minor Changes

- bc00dda: First release of Mossy — git worktree management desktop app.

  - Add/remove repositories with directory picker
  - Detect and list git worktrees per repository
  - Inline diff viewer with file list, unified diff display, and staging checkboxes
  - Commit box with message input and commit action
  - Branch toolbar with ahead/behind counts and push button
  - PR detection via GitHub CLI (`gh`)
  - GitHub Issues integration (global search for assigned issues)
  - Configurable issue tracker (GitHub Issues or none)
  - Settings panel for worktree base directory, repositories, and dependencies
  - Dark theme with shadcn/ui components
