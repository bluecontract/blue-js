# BLUE TS DSL SDK — Stage 6 testing strategy

## Test layers

### 1. Parity and materialization

Primary oracle:

- preprocess both documents,
- compare canonical `official` JSON,
- compare BlueIds where practical.

Stage 6 parity/materialization files:

- `libs/sdk-dsl/src/__tests__/StepsBuilder.paynote.test.ts`
- `libs/sdk-dsl/src/__tests__/PayNotes.parity.test.ts`

What they cover:

- typed PayNote document builders,
- typed PayNote event helpers,
- typed conversation bootstrap/customer-action helpers,
- deterministic macro materialization for `capture()/reserve()/release()`.

### 2. Processor-backed runtime proof

Stage 6 runtime files:

- `libs/sdk-dsl/src/__tests__/PayNotes.integration.test.ts`
- `libs/sdk-dsl/src/__tests__/CanonicalPayNoteBusiness.test.ts`

What they prove:

- capture lock / unlock / request flows,
- capture request on document update,
- reserve / release request flows,
- emitted-event request triggers,
- bootstrap delivery runtime flow,
- customer-action request + response handling,
- payment-mandate authorization + settlement handling.

### 3. Canonical scenario reconstruction

Acceptance corpus:

- `docs/ts-dsl-sdk/canonical-scenarios/paynote-business.md`

Reconstructed canonical scenarios:

- bootstrap delivery,
- customer-action delivery,
- payment-mandate authorization/settlement.

Each canonical scenario uses:

- structural equivalence against the canonical authored document,
- processor-backed runtime proof where the public runtime supports it directly or through a runtime-confirmed bridge.

## Runtime-proof rules

Stage 6 runtime tests follow these rules:

- use `document-processor` only in tests,
- prefer direct runtime execution over snapshots,
- do not claim external-event support on `triggeredEventChannel` when the runtime does not provide it,
- use runtime-confirmed bridges such as `myOsAdminUpdate` when the public runtime requires re-emission before an `onEvent(...)` matcher can run.

## Deviation handling

Every unavoidable deviation must be:

- documented in `stage-6-deviations.md`,
- backed by a focused regression test,
- kept narrow to the public runtime mismatch actually observed.
