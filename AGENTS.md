### Agent Guidelines

**Purpose**: Ensure every contribution is type-safe and lint-clean.

- **TypeScript**: All code must pass TypeScript type checking without errors.
- **ESLint**: All code must pass ESLint with no lint errors.

Before marking a task as complete, run your TypeScript type-check and ESLint linting locally and fix any reported issues.

Example commands (adjust to your workspace):

- `tsc` (or your workspace type-check command)
- `eslint .` (or your workspace lint command)

### Blue JS Workspace Commands

In Codex Desktop and other non-interactive shells, verify that `node` resolves to the project Node runtime before invoking `npx`, `nx`, `eslint`, or `vitest`:

```bash
node -p "process.execPath + ' ' + process.version"
```

If it resolves to a tool-bundled Node such as `/Applications/Codex.app/Contents/Resources/node`, prepend the Node binary directory selected by your local Node manager (NVM, fnm, asdf, mise, Volta, etc.) before running checks. One manager-agnostic way is to ask your login shell for its active `node`:

```bash
export BLUEJS_NODE_BIN="$(dirname "$("$SHELL" -lic 'command -v node' 2>/dev/null | tail -n 1)")"
export PATH="$BLUEJS_NODE_BIN:$PATH"
```

Without this, `npx` can spawn child scripts with the wrong Node runtime, which can make ESLint/Nx appear to hang or hit native Rollup loading errors.

- **Type check**: `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit`
- **ESLint**: `npx eslint libs/document-processor --fix` (use `npx eslint .` when runtime allows)
- **Tests (preferred)**: `npx nx test document-processor --skip-nx-cache`
  - If the Nx daemon or plugin worker fails, run `npx nx reset` and retry with `NX_DAEMON=false npx nx test document-processor --skip-nx-cache`.
  - As a fallback, execute the Vitest suite directly with `npx vitest run --config libs/document-processor/vite.config.ts`.
