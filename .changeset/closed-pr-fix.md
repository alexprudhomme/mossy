---
"mossy": patch
---

Fix closed PRs displaying as "draft" - now shows correct "closed" state with pink styling. Sort order updated to: Merged → Open → Closed → Draft → No PR → Paused. Fixed excessive GitHub API calls caused by unstable array reference in useWorktreePRs. Increased minimum poll interval to 120 seconds to prevent rate limiting.
