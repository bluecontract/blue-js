# PayNote business flows (Stage 6)

This scenario group is reserved for Stage 6 PayNote DSL and related Conversation helper materialization.

## Canonical scenarios

### PayNote bootstrap

Why included:
- establishes what a bootstrapped paynote document looks like before entering MyOS

Primary DSL surfaces:
- typed paynote document builders
- bootstrap-request-related helpers where applicable

### Capture lifecycle macro

Why included:
- proves the highest-level PayNote macro surface against a canonical flow
- keeps Stage 6 macro materialization anchored to runtime-confirmed operation wiring

Primary DSL surfaces:
- `PayNotes.payNote(...)`
- `.capture().lockOnInit()`
- `.capture().unlockOnOperation(...)`
- `.capture().requestOnOperation(...)`

### Bootstrap webhook handling

Why included:
- proves concrete document-type handling for:
  - `PayNote/PayNote`
  - `PayNote/Payment Mandate`
  - `PayNote/PayNote Delivery`
- proves bootstrap completion and reporting behavior from authored documents

Primary DSL surfaces:
- typed PayNote document builders
- `Conversation/Document Bootstrap Requested`
- generic conversation completion and failure events when modeled

### Delivery webhook handling

Why included:
- richest canonical scenario for paynote delivery documents
- covers nested bootstrap requests, payment-mandate linkage, and delivery error reporting

Primary DSL surfaces:
- `PayNote.payNoteDelivery(...)`
- `PayNote.paymentMandate(...)`
- conversation, bootstrap, and customer-action helpers around those documents

### Customer action request handling

Why included:
- canonical corpus for:
  - `Conversation/Customer Action Requested`
  - `Conversation/Customer Action Responded`
  - channel resolution and dispatch assumptions

Primary DSL surfaces:
- generic conversation event helpers
- paynote customer-action flows

### Delivery payload resolution and payment-mandate extraction

Why included:
- proves the concrete structure of delivery documents
- proves nested payment-mandate bootstrap requests
- proves runtime extraction assumptions

Primary DSL surfaces:
- `PayNote.payNoteDelivery(...)`
- `PayNote.paymentMandate(...)`
- nested bootstrap request helpers

### PayNote document operations

Why included:
- proves operational expectations around guarantor update and related runtime document operations

Primary DSL surfaces:
- raw and typed operation generation where paynote flows require them

## Explicit exclusions for Stage 6

Exclude:
- outward API handlers
- validation-only tests
- parsing-only utility tests

Reason:
- those are API, validation, or utility layers, not authored-document generation acceptance.

## Acceptance rule

For Stage 6, at minimum:
- one capture/reserve/release macro scenario
- one delivery or bootstrap scenario
- one customer-action scenario
- one payment-mandate extraction or bootstrap scenario
must be reconstructed and proven with zero drift.
