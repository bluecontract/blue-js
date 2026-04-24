# BlueId/Minimization Phase 0 Foundations

This document backfills the explicit Phase 0 deliverables and captures the
baseline used before and during Milestone 1 delivery.

## Scope statement (Milestone 1 boundary)

Milestone 1 is explicitly scoped to:

- single-document,
- acyclic,
- no `this#`,
- no `$pos` / `$previous`,
- `$empty` supported as content.

Deferred forms are rejected explicitly via `UnsupportedFeatureError` on
BlueId/minimization paths.

## Characterization baseline

Characterization and migration tests were established around:

- legacy permissive `blueId` short-circuit behavior,
- empty-value cleaning behavior differences (notably empty lists),
- minimization roundtrip invariants.

Relevant suites:

- `libs/language/src/lib/utils/__tests__/BlueIdCalculator.test.ts`
- `libs/language/src/lib/__tests__/Blue.collectionTyping.characterization.test.ts`
- `libs/language/src/lib/utils/__tests__/MergeReverser.test.ts`

## Provider/processor smoke baseline

Smoke coverage for integration-sensitive surfaces:

- language provider tests (Basic/RepositoryBased/Sequential providers),
- repository-generator deterministic snapshot tests,
- document-processor full runtime suite (channels/checkpoint/patch/workflow).

Representative commands:

```bash
npx nx test language --skip-nx-cache
npx nx test repository-generator --skip-nx-cache
npx nx test document-processor --skip-nx-cache
```

## Baseline benchmark fixtures

Benchmark scripts and fixtures exist under:

- `libs/language/scripts/benchmark/calculateBlueId.mjs`
- `libs/language/scripts/benchmark/resolve.mjs`
- `libs/language/scripts/benchmark/generateData.mjs`
- generated fixture directory: `libs/language/scripts/benchmark/data/`

Nx targets:

- `language:benchmark:generate-data`
- `language:benchmark:calculate-blue-id`
- `language:benchmark:resolve`
- `language:benchmark:resolve:unique`

## BlueId callsite inventory reference

The complete inventory is maintained in:

- `libs/language/docs/blueid-callsites-inventory.md`

It lists language/internal and cross-lib callsites for:

- `BlueIdCalculator.calculateBlueId*`
- `Blue.calculateBlueId*`
- fallback/derived identity calls in repository-generator and document-processor.

## Before/after phase performance comparisons

True cross-commit before/after results are recorded in:

- `libs/language/docs/blueid-phase-benchmark-comparisons.md`

Supporting machine-readable artifacts:

- `libs/language/scripts/benchmark/data/phase-comparisons/*.json`
