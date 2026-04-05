---
"mossy": patch
---

Fix update check silently reporting "You are on the latest version" when the check actually failed.

`Updater.checkForUpdate()` returns an error string when the update manifest can't be fetched (e.g. network issue or missing release asset), but `checkForAppUpdate()` was ignoring `info.error` and returning `success: true`. The UI then showed "You are on the latest version." instead of the actual error.

Both layers are now fixed: the backend propagates the error from the Electrobun Updater, and the UI checks `result.success` before deciding which message to display.
