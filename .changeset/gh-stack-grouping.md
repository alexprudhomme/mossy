---
"mossy": minor
---

Group worktrees that belong to a `gh stack` into a single ordered block on the dashboard. Stacked worktrees are shown bottom-to-top (closest to trunk first) inside a labelled container with the layer count, PR count and trunk branch, and each card gets a layer badge listing the full stack. Stack layers with no local worktree appear as placeholder rows so the ordering stays complete. Stacks are detected through GitHub's stacked-PR API in one batched request per repository, so stacks created by anyone on any machine are picked up; the local gh-stack files are used as an offline fallback.
