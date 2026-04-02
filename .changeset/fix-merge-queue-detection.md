---
"mossy": patch
---

Fix merge queue indicator by using GraphQL API to detect merge queue status instead of the unreliable `mergeStateStatus` field from `gh pr view`.
