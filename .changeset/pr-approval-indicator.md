---
"mossy": minor
---

Add PR review status indicator to the PR badge. Shows approval state (Approved, Changes requested, Review required) as a color-coded badge next to the existing PR and CI badges. Fetches the `reviewDecision` field from the GitHub API via `gh pr view`.
