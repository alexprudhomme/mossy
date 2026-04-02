# mossy

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
