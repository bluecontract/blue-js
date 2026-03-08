# BLUE TS DSL SDK — Stage 6 spec

## Purpose

Stage 6 adds the **payments / PayNote DSL** on top of the generic authoring layer from Stages 1–2, the MyOS/admin foundations from Stage 3, the interaction abstractions from Stage 4, and the AI orchestration layer from Stage 5.

This stage covers three categories of APIs:

1. **typed PayNote document builders**
2. **typed payment / conversation event helpers**
3. **macro-style PayNote action-flow builders** that may intentionally materialize multiple contracts/workflows

## Primary mapping references

Stage 6 must be implemented against:

- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`
- `docs/ts-dsl-sdk/complex-flow-materialization-reference.md`

Use them like this:
- `final-dsl-sdk-mapping-reference.md` defines document shapes, event payloads, field semantics, and repo/runtime-confirmed optionality.
- `complex-flow-materialization-reference.md` defines how high-level DSL expressions that represent flows are materialized into concrete contracts/workflows inside a document.

Java POC remains useful for:
- fluent API shape,
- nested builder behavior,
- naming,
- builder ergonomics,
- scenario discovery,
- parity intent.

When Java POC and the final mapping references disagree, the final mapping references win.

## Mapping sections relevant to Stage 6

Use these sections directly from `final-dsl-sdk-mapping-reference.md`:
- 2.1 explicit channels in runtime documents
- 2.2 `requestId`
- 2.4 inherited contracts vs explicit duplication
- 2.5 bootstrap payload vs bootstrap request event vs bootstrap document
- 3.4 pending actions and customer interactions
- 3.5 bootstrap-related Conversation events
- 5.9 `MyOS/Document Session Bootstrap`
- 6 only where Stage 6 composes with AI-created child/bootstrap flows
- 7.1–7.6 PayNote mappings
- 8.4 Stage 6 implications

Use `complex-flow-materialization-reference.md` for:
- macro-flow materialization templates,
- generated workflow/operation structure,
- validation rules for lock/unlock/request builders,
- the boundary between typed event helpers and true multi-contract flow builders.

## Scope

### In scope

#### Document builders
- `PayNotes.payNote(name)`
- `PayNotes.cardTransactionPayNote(name)`
- `PayNotes.merchantToCustomerPayNote(name)` if confirmed on this branch
- `PayNotes.payNoteDelivery(name)`
- `PayNotes.paymentMandate(name)`
- required fluent setters for repo/runtime-confirmed fields

#### Step/event helper namespaces
- `steps.paynote.*` typed helpers for Stage-6-confirmed native payloads
- `steps.conversation.documentBootstrapRequested/responded/completed/failed`
- `steps.conversation.customerActionRequested/responded`

#### Macro-style flow builders
- higher-level PayNote action builders discovered from Java refs and confirmed by the provided references
- examples: `capture()/reserve()/release()` families if the references support them cleanly

#### Tests and docs
- stage-6 parity tests
- stage-6 runtime integration tests
- stage-6 docs / coverage / deviation tracking

### Out of scope

- patch/editing compiler work
- introducing new backend/runtime semantics
- inventing new repo-native payment fields
- stage 7+

## Core semantics

### Typed document builders
Typed PayNote document builders should create the correct document `type` and expose confirmed fields. They should not duplicate inherited contracts unless an explicit runtime-confirmed reason exists.

### Typed event helpers
Typed payment/conversation helpers are thin wrappers over the lower-level Stage 2/3 step/event mechanisms. They exist for safety and DX, not because they introduce a new runtime abstraction.

### Macro-style flow builders
Some Stage-6 DSL expressions are intentionally higher-level and may materialize multiple contracts/workflows. This is allowed and expected, but only under the rules in `complex-flow-materialization-reference.md`.

## Exit criteria

Stage 6 is complete when:
- the stage-6 APIs exist,
- their parity coverage is in place,
- runtime integration proves real behavior,
- macro-style materialization is deterministic and tested,
- Stages 1–5 are not regressed,
- deviations are explicit and justified,
- the implementation is aligned to the final mapping references.
