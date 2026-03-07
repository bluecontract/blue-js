# Suite 40 — PayNote business/runtime scenarios (Stage 6)

This suite is the main acceptance corpus for PayNote DSL and related Conversation helper materialization.

## Included source tests

### PAY-S6-01 — PayNote bootstrap command
Source:
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/bootstrapPayNote.test.ts`

Why included:
- establishes what a bootstrapped paynote document looks like before entering MyOS.

Primary DSL surfaces:
- typed paynote document builders
- bootstrap-request-related helpers where applicable

### PAY-S6-02 — Bootstrap webhook handling
Source:
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/handlePayNoteBootstrapWebhookEvent.test.ts`

Why included:
- proves concrete document-type handling for:
  - `PayNote/PayNote`
  - `PayNote/Payment Mandate`
  - `PayNote/PayNote Delivery`
- proves bootstrap completion/reporting behavior from authored documents.

Primary DSL surfaces:
- typed PayNote document builders
- `Conversation/Document Bootstrap Requested`
- generic conversation completion/failure events when modeled

### PAY-S6-03 — Delivery webhook handling
Source:
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/handlePayNoteDeliveryWebhookEvent.test.ts`

Why included:
- the richest real scenario for:
  - paynote delivery documents,
  - nested bootstrap requests,
  - payment-mandate linkage,
  - delivery error reporting.

Primary DSL surfaces:
- `PayNote.payNoteDelivery(...)`
- `PayNote.paymentMandate(...)`
- conversation/bootstrap/customer-action helpers around those documents

### PAY-S6-04 — Customer action request handling
Sources:
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/paynoteWebhook/customerAction.test.ts`
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/paynoteWebhook/customerChannel.test.ts`
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/paynoteWebhook/eventDispatcher.test.ts`
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/paynoteWebhook/payload.test.ts`

Why included:
- this is the real corpus for:
  - `Conversation/Customer Action Requested`
  - `Conversation/Customer Action Responded`
  - channel resolution and dispatch assumptions

Primary DSL surfaces:
- generic conversation event helpers
- paynote customer-action flows

### PAY-S6-05 — Delivery payload resolution and payment-mandate extraction
Sources:
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/paynoteDeliveryWebhook/deliveryUpdate.test.ts`
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/paynoteDeliveryWebhook/identification.test.ts`
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/paynoteDeliveryWebhook/payload.test.ts`
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/paynoteDeliveryWebhook/paymentMandate.test.ts`

Why included:
- proves the concrete structure of delivery documents,
- proves nested payment-mandate bootstrap requests,
- proves real runtime extraction assumptions.

Primary DSL surfaces:
- `PayNote.payNoteDelivery(...)`
- `PayNote.paymentMandate(...)`
- nested bootstrap request helpers

### PAY-S6-06 — Document operations around paynotes
Source:
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/libs/paynotes/src/application/commands/documentOperations.test.ts`

Why included:
- proves the operational expectations around guarantor update and related runtime document operations.

Primary DSL surfaces:
- raw/typed operation generation where paynote flows require them

## Explicit exclusions for Stage 6

Exclude:
- `apps/bank-api/src/paynote/**`
- `validatePayNote.test.ts`
- `parsePayNotePdf.test.ts`

Reason:
- those are API/validation/util layers, not authored-document generation acceptance.

## Acceptance rule

For Stage 6, at minimum:
- one delivery/bootstrap scenario,
- one customer-action scenario,
- one payment-mandate extraction/bootstrap scenario
must be reconstructed and proven with zero drift.
