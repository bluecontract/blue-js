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

### 2. Generic patch tests
Verify:
- deterministic op ordering
- nested object replacement
- array handling
- add / replace / remove behavior
- apply(build()) roundtrip

### 3. BLUE-aware change compiler tests
Verify:
- root changes separated from contract changes
- contract additions
- contract replacements
- contract removals
- section preservation
- fallback grouping inference
- contract atomicity

### 4. Pipeline tests
For representative docs:
- build source via DSL
- build modified target via DSL
- extract `DocStructure`
- compile patch/change plan
- apply or compare compiled output
- assert canonical final equality
- assert structure equality

### 5. Generator/stub tests
If implemented:
- generator output deterministic
- stub output useful and stable
- output consistent with current public TS DSL

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
