# Stage 7 testing strategy

## Core principle

Stage 7 tests are **roundtrip and determinism** tests.

The primary oracles are:
1. canonical BLUE structure after preprocess,
2. deterministic patch/change-plan outputs,
3. stable structure summaries.

## Test layers

### 1. Structure extraction tests
Verify:
- root metadata extraction
- root fields extraction
- contract classification
- section extraction
- policy extraction
- unknown contract preservation
- stable output ordering

Implemented in:
- `libs/sdk-dsl/src/__tests__/DocStructure.test.ts`

### 2. Generic patch tests
Verify:
- deterministic op ordering
- nested object replacement
- array handling
- add / replace / remove behavior
- apply(build()) roundtrip

Implemented in:
- `libs/sdk-dsl/src/__tests__/DocPatch.test.ts`

Patch assertions use Stage-7 editing JSON values rather than raw YAML or
repository-specific snapshots. Paths remain the primary contract for human
review; value payloads must still roundtrip losslessly.

### 3. BLUE-aware change compiler tests
Verify:
- root changes separated from contract changes
- contract additions
- contract replacements
- contract removals
- section preservation
- fallback grouping inference
- contract atomicity

Implemented in:
- `libs/sdk-dsl/src/__tests__/BlueChangeCompiler.test.ts`

### 4. Pipeline tests
For representative docs:
- build source via DSL
- build modified target via DSL
- extract `DocStructure`
- compile patch/change plan
- apply or compare compiled output
- assert canonical final equality
- assert structure equality

Implemented in:
- `libs/sdk-dsl/src/__tests__/EditingPipeline.test.ts`

Current roundtrip scenarios:
- counter
- handlers/workflows
- MyOS orchestration
- AI orchestration
- PayNote orchestration

### 5. Generator/stub tests
If implemented:
- generator output deterministic
- stub output useful and stable
- output consistent with current public TS DSL

Current status:
- deferred in this stage
- covered as a documented gap rather than a weak placeholder implementation

## Required representative documents
At minimum:
- counter doc
- handlers/workflows doc
- MyOS orchestration doc
- AI doc
- PayNote doc

## Required assertions
- avoid raw YAML snapshots as primary oracle
- compare canonical `official` JSON after preprocess
- when useful, compare BlueIds too
- for generated TS text:
  - normalize line endings
  - assert stable textual output

## Regression discipline
Every deviation or runtime limitation discovered during stage 7 must have:
- one focused regression test
- one entry in `stage-7-deviations.md`
