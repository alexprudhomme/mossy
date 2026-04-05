---
"mossy": patch
---

Fix worktree diff line counts excluding untracked files. Previously, `+N -N` stats only counted tracked file changes via `git diff --numstat HEAD`, so new files that hadn't been staged yet were completely invisible. Now untracked files are discovered with `git ls-files --others --exclude-standard` and their line counts are added to the total.
