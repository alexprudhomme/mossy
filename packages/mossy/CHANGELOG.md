# mossy

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
