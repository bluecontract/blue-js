# BLUE TS DSL SDK — Stage 4 implementation plan

## Goal

Build the higher-level MyOS interaction builders on top of the existing Stage 3 foundations without widening scope into payments, AI, or later orchestration DSLs.

## Completed implementation

### Phase 0 — Baseline and source review

Completed:
- verified the pre-Stage-4 `sdk-dsl` baseline,
- read the stage-4 mapping sections from both mapping references,
- searched Java source and tests for:
  - `access(...)`
  - `accessLinked(...)`
  - `agency(...)`
  - nested `.done()` behavior
  - access / linked-access / worker-agency / worker-session scenarios

### Phase 1 — Shared interaction kernel

Completed in `libs/sdk-dsl/src/lib/internal/interactions.ts`:
- shared config models for access, linked access, and agency,
- deterministic token / id generation,
- runtime-correct permission-set builders,
- runtime-correct worker-agency permission materialization.

### Phase 2 — `DocBuilder.access(...)`

Completed in `libs/sdk-dsl/src/lib/builders/doc-builder.ts`:
- nested `AccessBuilder`,
- deterministic request/subscription ids,
- auto-materialized request / granted / rejected / revoked workflows,
- optional follow-up subscribe workflow and subscription-ready / failed handlers,
- support for init / event / doc-change / manual timing.

### Phase 3 — `DocBuilder.accessLinked(...)`

Completed in `libs/sdk-dsl/src/lib/builders/doc-builder.ts`:
- nested `LinkedAccessBuilder`,
- nested `link(...).done()` builder,
- runtime-correct linked-doc permission set materialization,
- request / granted / rejected / revoked workflows,
- validation for missing links.

### Phase 4 — `DocBuilder.agency(...)`

Completed in `libs/sdk-dsl/src/lib/builders/doc-builder.ts`:
- nested `AgencyBuilder`,
- worker-agency marker contract materialization,
- request / granted / rejected / revoked workflows,
- runtime-correct allowed-worker-permissions shape.

### Phase 5 — Stage-4 step composition

Completed in `libs/sdk-dsl/src/lib/builders/steps-builder.ts`:
- `steps.access(...)`
- `steps.viaAgency(...)`
- extended `steps.myOs()` helpers for linked-doc revoke / worker-agency / worker-session flows,
- thin binding and session-option builders for worker-session startup.

### Phase 6 — Processor-backed verification

Completed with runtime tests for:
- single-document access grant + subscription-ready flow,
- linked-documents access flow correlated by `requestId`,
- worker-agency grant followed by worker-session startup,
- Stage 3 + Stage 4 composition regression.

### Phase 7 — Docs and deviations

Completed:
- Stage 4 spec / testing / mapping / coverage docs updated,
- runtime-first deviations recorded explicitly,
- no document-processor changes introduced.

## Implementation notes

- Stage 4 composes Stage 3 matchers and MyOS helpers instead of bypassing them.
- Runtime-confirmed repo shapes took precedence over legacy Java-PoC fields.
- Section tracking and prior-stage behavior remain intact.
