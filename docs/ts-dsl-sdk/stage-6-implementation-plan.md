# BLUE TS DSL SDK — Stage 6 implementation plan

## Phase 1 — typed PayNote document builders

Implement or refine:
- `PayNotes.payNote(name)`
- `PayNotes.cardTransactionPayNote(name)`
- `PayNotes.merchantToCustomerPayNote(name)` if supported on this branch
- `PayNotes.payNoteDelivery(name)`
- `PayNotes.paymentMandate(name)`

Add fluent setters only for fields confirmed by the final mapping reference.
Do not expose ad-hoc fields as native first-class API when the mapping reference explicitly says not to.

## Phase 2 — typed event helpers

Implement or refine:
- `steps.paynote.*` request-event helpers
- `steps.conversation.documentBootstrapRequested/responded/completed/failed`
- `steps.conversation.customerActionRequested/responded`

These should compile to existing lower-level step/event primitives, not bypass them.

## Phase 3 — macro-style PayNote flow builders

Search the Java source and tests for stage-6-relevant flow builders and decide case-by-case:
- if the flow is confirmed by the final mapping references, implement it,
- if the Java builder depends on missing/non-current runtime semantics, document the deviation instead of guessing.

Focus especially on:
- `capture()`
- `reserve()`
- `release()`
- `lockOnInit()`
- `unlockOnEvent(...)`
- `unlockOnOperation(...)`
- `requestOnInit()`
- `requestOnEvent(...)`
- `requestOnOperation(...)`
- partial-request variants if they are clearly present and reference-confirmed

Use `complex-flow-materialization-reference.md` as the materialization source of truth.

## Phase 4 — tests

Add:
- parity tests for typed document builders
- parity tests for typed event helpers
- parity + structural tests for macro-style flow builders
- processor-backed integration tests for representative end-to-end scenarios

## Phase 5 — docs and cleanup

Update:
- `stage-6-spec.md`
- `stage-6-testing-strategy.md`
- `stage-6-mapping-matrix.md`
- `stage-6-coverage-matrix.md`
- `stage-6-deviations.md`
- `complex-flow-materialization-reference.md` only if a justified correction is required
