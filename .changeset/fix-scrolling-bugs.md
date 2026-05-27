---
"mossy": patch
---

Fix scrolling in Jira issue panel and main content area. Added `overflow-hidden` to the aside container so the issue panel properly constrains its height and enables internal scrolling. Added `min-h-0` to main to ensure it scrolls fully when many repos/worktrees are present.
