# BLUE TS DSL SDK — Stage 6 mapping matrix

## Document builders

- `PayNotes.payNote(name)` -> `PayNote/PayNote`
- `PayNotes.cardTransactionPayNote(name)` -> `PayNote/Card Transaction PayNote`
- `PayNotes.merchantToCustomerPayNote(name)` -> `PayNote/Merchant To Customer PayNote` when available on this branch
- `PayNotes.payNoteDelivery(name)` -> `PayNote/PayNote Delivery`
- `PayNotes.paymentMandate(name)` -> `PayNote/Payment Mandate`

## Typed step/event helpers

### `steps.paynote.*`
- `reserveFundsRequested(...)` -> `PayNote/Reserve Funds Requested`
- `captureFundsRequested(...)` -> `PayNote/Capture Funds Requested`
- `reserveFundsAndCaptureImmediatelyRequested(...)` -> `PayNote/Reserve Funds and Capture Immediately Requested`
- `reservationReleaseRequested(...)` -> `PayNote/Reservation Release Requested`
- `cardTransactionCaptureLockRequested(...)` -> `PayNote/Card Transaction Capture Lock Requested`
- `cardTransactionCaptureUnlockRequested(...)` -> `PayNote/Card Transaction Capture Unlock Requested`
- `startCardTransactionMonitoringRequested(...)` -> `PayNote/Start Card Transaction Monitoring Requested`
- `linkedCardChargeRequested(...)` -> `PayNote/Linked Card Charge Requested`
- `linkedCardChargeAndCaptureImmediatelyRequested(...)` -> `PayNote/Linked Card Charge and Capture Immediately Requested`
- `reverseCardChargeRequested(...)` -> `PayNote/Reverse Card Charge Requested`
- `reverseCardChargeAndCaptureImmediatelyRequested(...)` -> `PayNote/Reverse Card Charge and Capture Immediately Requested`
- `paymentMandateSpendAuthorizationRequested(...)` -> `PayNote/Payment Mandate Spend Authorization Requested`
- `paymentMandateSpendSettled(...)` -> `PayNote/Payment Mandate Spend Settled`

### `steps.conversation.*`
- `documentBootstrapRequested(...)` -> `Conversation/Document Bootstrap Requested`
- `documentBootstrapResponded(...)` -> `Conversation/Document Bootstrap Responded`
- `documentBootstrapCompleted(...)` -> `Conversation/Document Bootstrap Completed`
- `documentBootstrapFailed(...)` -> `Conversation/Document Bootstrap Failed`
- `customerActionRequested(...)` -> `Conversation/Customer Action Requested`
- `customerActionResponded(...)` -> `Conversation/Customer Action Responded`

## Macro-style builders

Use `complex-flow-materialization-reference.md`.
Examples expected to be considered in Stage 6:
- `capture()` family
- `reserve()` family
- `release()` family

Only implement macros whose materialization is confirmed by the final references and current runtime.
