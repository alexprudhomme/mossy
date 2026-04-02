# Copilot Instructions for gitpeek/mossy

## PR Workflow (mandatory)

Never commit directly to `main`. For every task:

1. **Create a feature branch** from `main` with a descriptive name (e.g. `fix/diff-race-condition`, `feat/jira-integration`)
2. **Make changes** and commit to the feature branch
3. **Add a changeset file** using `pnpm changeset` or by creating a `.changeset/<name>.md` file:
   - Use `patch` for bug fixes, refactors, and small improvements
   - Use `minor` for new features or significant UI changes
   - The package name is `mossy`
4. **Push the branch** and **open a PR** against `main`

## Changeset Format

```md
---
"mossy": patch
---

Short description of what changed and why.
```

## Code Conventions

- TypeScript throughout (strict mode)
- React + Vite for the renderer
- Tailwind CSS v3 + shadcn/ui for styling
- Electrobun for the desktop shell, Bun for the backend
- RPC types defined in `packages/mossy/src/shared/rpc-types.ts`
- Browser-dev stubs in `packages/mossy/src/browser-dev/index.tsx` must be kept in sync with backend changes
- Build with `npx vite build` from `packages/mossy/` before committing
