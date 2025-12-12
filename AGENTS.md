### Agent Guidelines

**Purpose**: Ensure every contribution is type-safe and lint-clean.

- **TypeScript**: All code must pass TypeScript type checking without errors.
- **ESLint**: All code must pass ESLint with no lint errors.

Before marking a task as complete, run your TypeScript type-check and ESLint linting locally and fix any reported issues.

Example commands (adjust to your workspace):

- `tsc` (or your workspace type-check command)
- `eslint .` (or your workspace lint command)

### Blue JS Workspace Commands

- **Type check**: `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit`
- **ESLint**: `npx eslint libs/document-processor --fix` (use `npx eslint .` when runtime allows)
- **Tests (preferred)**: `nx test document-processor --skip-nx-cache`
  - If the Nx daemon or plugin worker fails, run `nx reset` and retry with `NX_DAEMON=false nx test document-processor --skip-nx-cache`.
  - As a fallback, execute the Vitest suite directly with `npx vitest run --config libs/document-processor/vite.config.ts`.
