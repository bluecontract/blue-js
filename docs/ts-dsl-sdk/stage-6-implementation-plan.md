# BLUE TS DSL SDK — Stage 6 implementation plan

## Result

Stage 6 is implemented as a thin PayNote layer on top of the existing Stage 1–5 primitives.

The work landed in four concrete buckets:

## 1. Typed document builders

Implemented in `libs/sdk-dsl/src/lib/builders/paynote-builder.ts`:

- `PayNotes.payNote(name)`
- `PayNotes.cardTransactionPayNote(name)`
- `PayNotes.merchantToCustomerPayNote(name)`
- `PayNotes.payNoteDelivery(name)`
- `PayNotes.paymentMandate(name)`

Only repo-confirmed fields were exposed as first-class fluent setters.

## 2. Typed PayNote / conversation step helpers

Implemented in `libs/sdk-dsl/src/lib/builders/steps-builder.ts`:

- `steps.paynote()`
- `steps.conversation()`

These helpers compile to the existing Stage 2 trigger-event primitives and preserve canonical payload shapes from the public mapping reference.

## 3. Macro-style PayNote action builders

Implemented in `libs/sdk-dsl/src/lib/builders/paynote-builder.ts`:

- `capture()`
- `reserve()`
- `release()`

Materialization decisions:

- init-triggered and event-triggered branches use normal sequential workflows
- operation-triggered branches use sequential workflow operations
- operation-triggered branches keep explicit request schemas required by the current public runtime:
  - `Boolean` for trigger-only operations
  - `Integer` for partial-amount operations
- reserve/release lock helpers remain unsupported because the current public repo does not provide confirmed native event types for them

## 4. Tests and canonical scenarios

Added Stage 6 coverage in:

- `libs/sdk-dsl/src/__tests__/StepsBuilder.paynote.test.ts`
- `libs/sdk-dsl/src/__tests__/PayNotes.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/PayNotes.integration.test.ts`
- `libs/sdk-dsl/src/__tests__/CanonicalPayNoteBusiness.test.ts`

Covered canonical runtime/business areas:

- bootstrap delivery,
- customer-action delivery,
- payment-mandate authorization/settlement,
- capture macro lifecycle,
- reserve/release request flows.

## 5. Documentation and deviations

Stage 6 docs were finalized to reflect the implemented public runtime subset and the narrow remaining deviations:

- reserve/release lock helpers unsupported on the current public repo
- correction-cycle re-verification confirmed that operation-triggered PayNote macros still require explicit request schemas on the current public runtime
- external events do not directly feed `triggeredEventChannel` on the current public runtime
