---
"mossy": patch
---

Jira indicator now prefers the issue key from the PR description over the branch name. When a PR exists, the issue key is extracted from its body; when no PR exists, falls back to the branch name. Shows nothing if no issue key is found in either source.
