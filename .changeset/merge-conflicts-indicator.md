---
"mossy": minor
---

Add merge conflicts indicator badge to worktree cards. Each non-main branch now shows an orange badge when it has merge conflicts with the target branch (e.g. `main`), including the count and list of conflicting files in the tooltip. Uses `git merge-tree --write-tree` for non-destructive conflict detection with 60s result caching.
