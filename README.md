# Mossy

A macOS desktop app for managing git worktrees across multiple repositories.

![Mossy](https://img.shields.io/badge/platform-macOS-lightgrey) ![License](https://img.shields.io/badge/license-MIT-blue)

## What it does

Mossy gives you a dashboard of all your repos and their worktrees. From one window you can see what's changed, stage files, commit, and push — without switching terminals or editor windows.

- **Multi-repo dashboard** — configure repos, view all worktrees at a glance
- **Inline diff viewer** — expand any worktree card to stage/unstage files, write a commit message, and push
- **PR & CI badges** — see PR status, review decision, and CI results on each card
- **Issue tracking** — connect Jira or GitHub Issues; drag an issue onto a repo to create a worktree named after it
- **IDE & terminal launch** — open any worktree in VS Code, Cursor, Zed, IntelliJ, WebStorm, Sublime, or Ghostty
- **Merge conflict detection** — badge on cards that have conflicts against the default branch
- **Automatic updates** — checks for new versions in the background

## Installation

Download the latest `.dmg` from the [Releases](../../releases) page, open it, and drag Mossy to your Applications folder.

## Requirements

- macOS (Apple Silicon)
- [`gh`](https://cli.github.com/) — for PR badges and GitHub Issues (`brew install gh`)
- [`jira`](https://github.com/ankitpokhrel/jira-cli) — optional, only needed for Jira integration

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Electrobun](https://github.com/blackboardsh/electrobun) |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Build | Vite |
| Runtime | Bun |
| Package manager | pnpm (monorepo) |

## Development

```bash
pnpm install
cd packages/mossy
pnpm dev          # build + launch in dev mode
pnpm dev:browser  # UI only in a browser (no native backend)
pnpm test         # run tests
```

## License

MIT — see [LICENSE](LICENSE)
