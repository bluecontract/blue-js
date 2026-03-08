# Stage 7 implementation plan

## Overview

Stage 7 completes the SDK with an editing pipeline. The safest implementation order is:

1. stabilize structure extraction,
2. stabilize generic patching,
3. add BLUE-aware change planning,
4. add regeneration helpers,
5. finish with roundtrip and regression tests.

## Phase 1 — structure extraction
Implemented:
- `DocStructure`
- `FieldEntry`
- `ContractEntry`
- `SectionEntry`
- `ContractKind`

Expected capabilities:
- root metadata extraction
- root field inventory with stable path ordering
- contract inventory with compact summaries
- section extraction
- policy extraction
- unknown contract preservation

Minimum output shape:
- `name?: string`
- `description?: string`
- `type?: string`
- `fields: Array<{ path, kind, preview, rawValue? }>`
- `contracts: Array<{ key, type, kind, summary, channel?, operation?, requestType?, raw }>`
- `sections: Array<{ key, title?, summary?, relatedFields, relatedContracts }>`
- `policies: Array<{ key, type, summary, raw }>`
- `unknownContracts: Array<{ key, raw }>`

Also implement:
- `toSummaryJson()`
- `toPromptText()`

## Phase 2 — generic patching
Implemented:
- `DocPatch`
- generic diff/apply helpers

Requirements:
- deterministic op ordering
- stable behavior for arrays, nested objects, primitives
- generic JSON/BlueNode semantics only
- no BLUE-aware section/contract inference here
- use the Stage-7 editing JSON envelope for metadata-bearing nodes
- keep root patch paths human-meaningful

Suggested API:
- `DocPatch.from(originalNode)`
- builder methods that mutate an internal JSON clone
- `build()` returns generic patch ops
- `apply(node)` or equivalent helper for tests

## Phase 3 — BLUE-aware change compiler
Implemented:
- `BlueChangeCompiler`
- `BlueChangePlan`

Suggested plan shape:
- `rootChanges`
- `contractAdds`
- `contractReplacements`
- `contractRemovals`
- `groupedChanges`
- `notes / warnings`

Rules:
- contracts are atomic units
- preserve known section groupings
- infer fallback groups:
  - `participants`
  - `logic`
  - `ai`
  - `payments`
  - `paynote`
  - `misc`

## Phase 4 — regeneration helpers
Deferred for now:
- `DslStubGenerator`
- `DslGenerator`

Reason:
- the core extraction / patch / plan pipeline is now complete and green
- reconstructing stable TS-first generator output without inventing author intent
  needs a separate pass
- the deferment is documented in `stage-7-deviations.md`

## Phase 5 — testing matrix
Required suites:
- `DocStructure.test.ts`
- `DocPatch.test.ts`
- `BlueChangeCompiler.test.ts`
- `StructurePatchPipeline.test.ts`
- implemented as:
  - `DocStructure.test.ts`
  - `DocPatch.test.ts`
  - `BlueChangeCompiler.test.ts`
  - `EditingPipeline.test.ts`
- deferred with generators:
  - `DslStubGenerator.test.ts`
  - `DslGenerator.test.ts`

Recommended pipeline scenarios:
- counter doc
- handlers doc
- MyOS session interaction doc
- access/agency doc
- AI doc
- PayNote doc

For each:
1. build base document via DSL
2. extract structure
3. create modified target doc via DSL
4. compute generic patch and/or BLUE-aware plan
5. apply patch or compare compiled plan
6. assert final doc equivalence
7. assert structure equivalence

## Phase 6 — docs and cleanup
Update:
- `stage-7-testing-strategy.md`
- `stage-7-mapping-matrix.md`
- `stage-7-coverage-matrix.md`
- `stage-7-deviations.md`
- `editing-materialization-reference.md`

## Verification
Run:
- `npx tsc -p libs/sdk-dsl/tsconfig.lib.json --noEmit`
- `npx tsc -p libs/sdk-dsl/tsconfig.spec.json --noEmit`
- `npx eslint libs/sdk-dsl`
- `npx vitest run --config libs/sdk-dsl/vite.config.ts`
- `npx vite build --config libs/sdk-dsl/vite.config.ts`
