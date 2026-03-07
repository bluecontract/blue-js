# BLUE TS DSL SDK — Stage 2 Implementation Plan

## Objective
Add workflow handler authoring and richer step composition on top of the green stage-1 `libs/sdk-dsl` implementation.

## High-level plan
### Phase 0 — Baseline lock
- run current stage-1 verification
- confirm stage-1 tests are green before any changes
- inventory current `DocBuilder` and `StepsBuilder` internals

### Phase 1 — Handler authoring contracts
Implement or extend `DocBuilder` to support:
- `onInit(...)`
- `onEvent(...)`
- `onNamedEvent(...)`
- `onDocChange(...)`
- `onChannelEvent(...)`

Expected likely files:
- `libs/sdk-dsl/src/lib/doc-builder.ts`
- `libs/sdk-dsl/src/lib/internal/contracts.ts`
- `libs/sdk-dsl/src/lib/internal/type-input.ts`

Key design requirements:
- generated helper channels are deterministic
- existing channels are reused rather than duplicated
- insertion order remains stable
- handler contracts integrate with section tracking if a section is open

### Phase 2 — Changeset-driven steps
Implement stage-2 `StepsBuilder` additions:
- `updateDocument(...)`
- `updateDocumentFromExpression(...)`
- `namedEvent(...)`

Expected likely files:
- `libs/sdk-dsl/src/lib/steps-builder.ts`
- `libs/sdk-dsl/src/lib/internal/changeset-builder.ts`
- `libs/sdk-dsl/src/lib/internal/node-object-builder.ts`

Key design requirements:
- changeset entry ordering is stable
- expressions are wrapped exactly once
- blank and reserved paths are rejected
- named-event payload customizer is deterministic

### Phase 3 — Bootstrap document helpers and extension hook
Implement:
- `bootstrapDocument(...)`
- `bootstrapDocumentExpr(...)`
- `BootstrapOptionsBuilder`
- `ext(factory)`

Expected likely files:
- `libs/sdk-dsl/src/lib/steps-builder.ts`
- `libs/sdk-dsl/src/lib/internal/bootstrap-options-builder.ts`
- `libs/sdk-dsl/src/lib/internal/node-object-builder.ts`

Key design requirements:
- document node vs expression mode is preserved
- channelBindings serialization is deterministic
- optional bootstrap messages follow the Java structure
- extension hook remains generic and small

### Phase 4 — Parity tests
Port or adapt the relevant Java parity tests:
- general parity: `onEvent`, `onNamedEvent`, `onDocChange`, `onInit`
- channel parity: `onChannelEvent`
- steps parity subset:
  - step primitives subset
  - bootstrap document builders
  - explicit step-name guardrails
  - extension hook guardrails

Expected likely files:
- `libs/sdk-dsl/src/__tests__/DocBuilder.general.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.channels.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.steps.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/ChangesetBuilder.guardrails.test.ts`

### Phase 5 — Runtime tests
Add processor-backed tests for:
- `onInit(...)`
- `onEvent(...)`
- `onNamedEvent(...)`
- `onDocChange(...)`
- `updateDocumentFromExpression(...)`
- `bootstrapDocument(...)` emitted-event shape

Expected likely files:
- `libs/sdk-dsl/src/__tests__/DocBuilder.handlers.integration.test.ts`
- `libs/sdk-dsl/src/__tests__/StepsBuilder.integration.test.ts`
- shared support under `libs/sdk-dsl/src/__tests__/support/**`

### Phase 6 — Documentation and verification
Update:
- `docs/ts-dsl-sdk/stage-2-spec.md`
- `docs/ts-dsl-sdk/stage-2-testing-strategy.md`
- `docs/ts-dsl-sdk/stage-2-mapping-matrix.md`
- `docs/ts-dsl-sdk/stage-2-deviations.md`
- `docs/ts-dsl-sdk/stage-2-coverage-matrix.md`

Run:
- `npx tsc -p libs/sdk-dsl/tsconfig.lib.json --noEmit`
- `npx tsc -p libs/sdk-dsl/tsconfig.spec.json --noEmit`
- `npx eslint libs/sdk-dsl`
- `npx vitest run --config libs/sdk-dsl/vite.config.ts`
- `npx vite build --config libs/sdk-dsl/vite.config.ts`

## Risks to avoid
- drifting into MyOS / AI / payments / PayNote scope
- regressing stage-1 parity helper or stage-1 tests
- silently using runtime-only shapes without documenting Java mismatch
- importing `document-processor` into the runtime library build
- weakening parity tests to avoid fixing mapping issues
