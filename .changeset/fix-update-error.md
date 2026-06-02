---
"mossy": patch
---

Fix misleading "Failed to check for updates" error when applyUpdate throws after the restart dialog is shown. Now properly catches apply failures and shows a specific error message instead of the generic check failure.
