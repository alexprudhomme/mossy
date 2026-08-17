---
"mossy": minor
---

Group worktrees that belong to a `gh stack` into a single ordered block on the dashboard. Stacked worktrees are shown bottom-to-top (closest to trunk first) inside a labelled container with the stack number, layer count, PR count and trunk branch, and each card gets a layer badge listing the full stack. Stack layers with no local worktree appear as placeholder rows so the ordering stays complete. Stack state is read from the local gh-stack files, merging the per-worktree copies that `gh stack` writes.
