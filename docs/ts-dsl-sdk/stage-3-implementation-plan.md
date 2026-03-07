# BLUE TS DSL SDK — Stage 3 implementation plan

## Goal

Add MyOS/admin/session-interaction foundation without drifting into access/agency/AI/payments.

## Phase 0 — Baseline

- run existing stage-1 and stage-2 verification commands
- confirm `libs/sdk-dsl` baseline is green before stage-3 changes
- inspect existing helpers and test harness for reuse
- inspect `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`
- inspect `references/java-sdk/**` for stage-3-relevant tests and examples

## Phase 1 — `myOsAdmin(...)`

Deliverables:
- add `DocBuilder.myOsAdmin(...)`
- implement the standard admin channel/update/updateImpl contracts from mapping-reference section 5.1
- add parity tests
- add runtime test proving admin update re-emits delivered events

Review points:
- idempotency / replacement behavior when the contracts already exist
- compatibility with non-admin root document types
- avoid duplicating inherited contracts on `MyOS/MyOS Admin Base`

## Phase 2 — Triggered-event matcher helpers

Deliverables:
- add:
  - `onTriggeredWithId(...)`
  - `onTriggeredWithMatcher(...)`
  - `onSubscriptionUpdate(...)`
  - `onMyOsResponse(...)`
- port the stage-3-relevant Java tests or reproduce their behavior closely
- align matcher contract shapes to mapping-reference sections 4.5, 5.4, and 5.5

Review points:
- subscription id filtering
- `inResponseTo` matching
- exact triggered-event channel usage
- no assumption of `Common/Named Event`

## Phase 3 — `MyOsSteps`

Deliverables:
- add `steps.myOs()` / `MyOsSteps`
- add runtime-correct helper builders for:
  - `MyOS/Single Document Permission Grant Requested`
  - `MyOS/Subscribe to Session Requested`
  - `MyOS/Call Operation Requested`
- parity tests for generated event payloads

Review points:
- wrappers should remain thin and predictable
- avoid inventing additional helper concepts not needed for stage-3 scenarios
- keep payload shape aligned to mapping-reference sections 5.2, 5.4, and 5.5

## Phase 4 — Runtime integration suite

Deliverables:
- processor-backed tests for:
  - admin update re-emission
  - subscription update filtering
  - call-response or response matcher flow
  - one non-admin session-interaction flow using the new helpers
  - one end-to-end counter/session scenario if supported cleanly by runtime

Review points:
- keep runtime tests explanatory
- prefer small vertical slices over giant scenario blobs
- prefer mapping-reference-confirmed flows over Java-only legacy shapes

## Phase 5 — Docs and coverage

Deliverables:
- fill `stage-3-mapping-matrix.md`
- fill `stage-3-coverage-matrix.md`
- fill `stage-3-deviations.md`
- keep the final mapping reference linked but do not fork it into a second conflicting reference

## Non-goals

Do not:
- implement access/linked-access/agency
- implement AI
- implement payments/PayNote
- redesign the SDK architecture
- change `document-processor`
