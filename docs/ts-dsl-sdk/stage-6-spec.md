# BLUE TS DSL SDK — Stage 6 spec

## Purpose

Stage 6 adds the public PayNote DSL layer on top of:

- Stage 1 document authoring,
- Stage 2 handlers and step composition,
- Stage 3 MyOS/admin foundations,
- Stage 4 access/agency abstractions,
- Stage 5 AI orchestration.

This stage is intentionally limited to repo-confirmed PayNote documents, typed PayNote/conversation events, and macro-style payment flows that are executable on the current public runtime.

## Primary references

Stage 6 is implemented against:

- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`
- `docs/ts-dsl-sdk/complex-flow-materialization-reference.md`
- `docs/ts-dsl-sdk/canonical-scenarios/paynote-business.md`

Java references remain secondary for:

- public API shape,
- naming,
- fluent ergonomics,
- nested builder behavior,
- scenario discovery.

When Java POC and the public mapping/runtime differ, Stage 6 follows the public mapping/runtime and records the drift in `stage-6-deviations.md`.

## Implemented public surface

### Typed PayNote document builders

- `PayNotes.payNote(name)`
- `PayNotes.cardTransactionPayNote(name)`
- `PayNotes.merchantToCustomerPayNote(name)`
- `PayNotes.payNoteDelivery(name)`
- `PayNotes.paymentMandate(name)`

### Typed PayNote step helpers

- `steps.triggerPayment(...)`
- `steps.requestBackwardPayment(...)`
- `steps.paynote().reserveFundsRequested(...)`
- `steps.paynote().captureFundsRequested(...)`
- `steps.paynote().reserveFundsAndCaptureImmediatelyRequested(...)`
- `steps.paynote().reservationReleaseRequested(...)`
- `steps.paynote().cardTransactionCaptureLockRequested(...)`
- `steps.paynote().cardTransactionCaptureUnlockRequested(...)`
- `steps.paynote().startCardTransactionMonitoringRequested(...)`
- `steps.paynote().linkedCardChargeRequested(...)`
- `steps.paynote().linkedCardChargeAndCaptureImmediatelyRequested(...)`
- `steps.paynote().reverseCardChargeRequested(...)`
- `steps.paynote().reverseCardChargeAndCaptureImmediatelyRequested(...)`
- `steps.paynote().paymentMandateSpendAuthorizationRequested(...)`
- `steps.paynote().paymentMandateSpendSettled(...)`

### Typed conversation helpers used by PayNote flows

- `steps.conversation().documentBootstrapRequested(...)`
- `steps.conversation().documentBootstrapRequestedExpr(...)`
- `steps.conversation().documentBootstrapResponded(...)`
- `steps.conversation().documentBootstrapCompleted(...)`
- `steps.conversation().documentBootstrapFailed(...)`
- `steps.conversation().customerActionRequested(...)`
- `steps.conversation().customerActionResponded(...)`

### Macro-style PayNote flow builders

- `capture()`
- `reserve()`
- `release()`

Implemented nested methods:

- `lockOnInit()`
- `unlockOnEvent(...)`
- `unlockOnDocPathChange(...)`
- `unlockOnOperation(...)`
- `requestOnInit()`
- `requestOnEvent(...)`
- `requestOnDocPathChange(...)`
- `requestOnOperation(...)`
- `requestPartialOnOperation(...)`
- `requestPartialOnEvent(...)`
- `done()`

## Runtime-confirmed semantics

### Typed document builders

The typed builders set the correct document type and expose only repo-confirmed fields. They do not duplicate inherited repo contracts.

### Typed event helpers

The typed step helpers are thin wrappers over the existing Stage 2 trigger-event APIs. They do not introduce a new runtime abstraction.

`steps.triggerPayment(...)` adds a thin generic payment-emission convenience layer with a shared `PaymentRequestPayloadBuilder` and rail-specific builders. `steps.requestBackwardPayment(...)` uses the same payload builder but is guarded by runtime repository alias availability.

### Macro materialization

The `capture()/reserve()/release()` families materialize normal Conversation contracts using deterministic keys.

Runtime-confirmed Stage 6 rules:

- `lockOnInit()` validates that at least one unlock path exists before `buildDocument()`.
- operation-triggered macro branches materialize executable request schemas on the current public runtime:
  - `unlockOnOperation(...)` -> `request: { type: Boolean }`
  - `requestOnOperation(...)` -> `request: { type: Boolean }`
  - `requestPartialOnOperation(...)` -> `request: { type: Integer }`
- correction-cycle re-verification confirmed that omitting `request` still leaves these sequential workflow operations unmatched on the current public runtime
- `requestOnEvent(...)` and `unlockOnEvent(...)` still materialize `triggeredEventChannel` workflows, but processor-backed runtime delivery requires the matched event to be internally emitted or re-emitted through a runtime-confirmed bridge such as `myOsAdminUpdate`.

### Unsupported subset

The public repo does not currently confirm native reserve/release lock and unlock event types. Stage 6 therefore does not materialize reserve/release lock helpers and treats them as documented deviations.

The public repo also does not currently expose `PayNote/Backward Payment Requested`, so `requestBackwardPayment(...)` fails clearly instead of materializing an unresolved event type.

## Acceptance scenarios covered

Stage 6 reconstructs and proves these public scenarios:

- bootstrap delivery flow,
- customer-action delivery flow,
- payment-mandate authorization/settlement flow,
- capture macro lifecycle,
- reserve/release request lifecycle.

## Exit criteria

Stage 6 is complete when:

- the Stage 6 APIs above exist,
- parity/materialization coverage is present,
- processor-backed runtime tests prove the executable subset,
- canonical PayNote business scenarios are reconstructed with the DSL,
- Stages 1–5 remain green,
- all remaining deviations are narrow and explicit.
