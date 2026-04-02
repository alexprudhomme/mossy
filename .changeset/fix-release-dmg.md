---
"mossy": patch
---

Fix release workflow to produce signed .dmg artifacts.

- Fix package name references (gitpeek → mossy) and artifact paths (build/ → artifacts/)
- Add macOS code signing setup (Apple certificate chain + keychain) matching treebeard's approach
- Enable codesign in electrobun config
- Add release baseUrl for future auto-update support
- Upload .dmg, .tar.zst, and update.json to GitHub Releases
