# Stage 7 spec — editing pipeline

## Goal

Deliver the **editing / patch / regeneration** layer for the TypeScript BLUE DSL SDK on top of the already implemented authoring DSL (stages 1–6).

This stage is about turning existing BLUE documents back into a stable, editable representation and compiling deterministic edits back into patch/change plans.

The result should make it possible to:
- inspect an arbitrary BLUE document,
- extract a stable structure summary,
- generate minimal edit plans,
- apply generic patches,
- compile BLUE-aware change plans,
- and optionally regenerate useful DSL stubs / DSL code skeletons for human or agent-assisted editing.

## Source-of-truth priority

1. `docs/ts-dsl-sdk/editing-materialization-reference.md`
2. `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`
3. `docs/ts-dsl-sdk/complex-flow-materialization-reference.md`
4. `references/java-sdk/src/main/java/blue/language/sdk/structure/**`
5. `references/java-sdk/src/main/java/blue/language/sdk/patch/**`
6. `references/java-sdk/src/test/java/blue/language/sdk/structure/**`
7. `references/java-sdk/src/test/java/blue/language/sdk/patch/**`
8. public TS runtime APIs in `libs/language` and `libs/document-processor`

Java is a reference for editing concepts and expected ergonomics.
Current TS runtime behavior is the execution/build gate.

## In scope

### Structure extraction
- `DocStructure.from(node)`
- stable root metadata extraction:
  - `name`
  - `description`
  - `type`
- stable root field inventory
- stable contract inventory
- section extraction
- policy extraction
- unknown/unclassified contract handling
- compact summaries:
  - `toSummaryJson()`
  - `toPromptText()`

### Patch / diff
- `DocPatch.from(originalNode)`
- deterministic generic RFC-6902 style diff/apply utility
- stable op ordering
- deterministic behavior for nested objects / arrays

### BLUE-aware change compilation
- `BlueChangeCompiler`
- `BlueChangePlan`
- split:
  - root-field changes
  - contract changes
  - section-aware grouping
- contract changes treated as atomic whole-contract replacements
- deterministic grouping buckets for unsectioned contracts

### Regeneration helpers
- `DslStubGenerator`
- `DslGenerator` or equivalent TS surface if implementable within current scope
- generators should be useful for editing workflows, not necessarily perfect pretty-printers
- if full Java parity is not realistic, produce stable and documented TS-first output

### Tests
- structure extraction tests
- patch roundtrip tests
- change compiler tests
- optional generator/stub tests
- pipeline tests:
  - build via DSL
  - extract structure
  - compute patch / change plan
  - apply / rebuild
  - assert equivalence

## Out of scope
- new authoring DSL features from stages 1–6
- changes to MyOS / processor runtime
- changes to repository types
- stage-8 polish / packaging work
- changing already-working flow materialization unless needed for editing correctness

## Required behavioral rules

### DocStructure
- never throw on unknown contracts
- unknown shapes must be preserved and classified as `other`
- output ordering must be stable
- sections must preserve `relatedFields` and `relatedContracts`
- contract classification should be best-effort and explicit

### DocPatch
- remains generic
- does not infer BLUE semantics on its own
- supports deterministic `build()` and `apply()`

### BlueChangeCompiler
- root field changes compile separately from contract changes
- `/contracts/<key>` changes are atomic:
  - add whole contract
  - replace whole contract
  - remove whole contract
- do not emit partial in-contract patch ops
- preserve known section membership when possible
- infer stable grouping buckets when section is absent

### Generators
- generated stubs/code must be deterministic
- generator output must prefer current TS DSL naming and public APIs
- if exact Java regeneration is not feasible, document deviations rather than guessing

## Definition of done

Stage 7 is complete when:
- `DocStructure.from(...)` is stable and well-tested
- `DocPatch.from(...)` passes deterministic roundtrip tests
- `BlueChangeCompiler` exists and is tested
- structure + patch + rebuild pipeline tests pass
- generator/stub helpers are implemented or explicitly deferred with justification
- docs are complete and aligned with the implementation
- verification commands pass
