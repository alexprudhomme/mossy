---
"mossy": minor
---

Add a "Create worktree" button to stack layers that have no local worktree. Stacks are detected from GitHub, so a stack can include layers you have never checked out; the button creates a worktree for that branch in place, running the repo's setup commands afterwards like any other worktree creation.
