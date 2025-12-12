# @blue-labs/repository-generator

Generate (or check) a `BlueRepository.blue` file from a set of package folders containing `.blue` and `.dev.blue` definitions. It replaces inline type references with BlueIds, computes type-level and repo-level BlueIds, and enforces versioning/lifecycle rules.

## Usage

### CLI

```bash
npx ts-node libs/repository-generator/src/bin/blue-repo-generator.ts \
  --repo-root <path-to-packages-root> \
  --blue-repository <output-file> \
  --mode check|write \
  [--verbose] [--json] [--allow-diff]
```

- `--mode check` regenerates in-memory and exits non-zero if `BlueRepository.blue` is out of date (unless `--allow-diff` is set).
- `--mode write` writes `BlueRepository.blue` if missing or if the repo BlueId changed.
- `--json` (with `--mode check`) prints a small status payload.
- `--allow-diff` (with `--mode check`) reports a mismatch but exits 0, useful for CI previews where the file is expected to differ.

### Programmatic API

```ts
import { generateRepository } from '@blue-labs/repository-generator';

const result = generateRepository({
  repoRoot: '/path/to/packages',
  blueRepositoryPath: '/path/to/packages/BlueRepository.blue',
  mode: 'write', // or 'check'
  verbose: true,
});

console.log(result.currentRepoBlueId);
console.log(result.document); // BlueRepositoryDocument
```

## Behaviors & invariants (summary)

- Supports primitives with hardcoded BlueIds and resolves non-primitive aliases to BlueIds before hashing.
- Dev types store a single version entry; unchanged dev types keep their previous BlueId/version index.
- Stable types:
  - Breaking changes (non-optional diffs) are rejected.
  - Stable → dev downgrade is rejected.
  - Stable types cannot depend on dev types.
- Dependency graph is topo-sorted; aliases are validated and cycles rejected.
- Output is deterministic (sorted packages/types/versions); repo BlueId covers the packages subtree only.

## Tests

```bash
npx nx test repository-generator --skip-nx-cache
npx nx lint repository-generator
npx nx typecheck repository-generator
```
