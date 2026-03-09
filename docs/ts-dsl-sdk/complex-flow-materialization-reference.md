# Complex flow materialization reference for BLUE TS DSL SDK

This document is the source of truth for **macro-style DSL expressions** that intentionally materialize multiple contracts/workflows.

It complements `final-dsl-sdk-mapping-reference.md`:

- `final-dsl-sdk-mapping-reference.md` defines payloads, document shapes, and repo/runtime-confirmed field semantics.
- this document defines how higher-level DSL expressions materialize those payloads/shapes into concrete contracts/workflows in the document.

## 1. Global rules

### 1.1 One DSL expression may create multiple contracts

This is allowed for builder expressions that represent an orchestration, not a single raw contract.

Examples:

- `myOsAdmin(...)`
- `access(...)`
- `accessLinked(...)`
- `agency(...)`
- `ai(...).done()`
- PayNote action-flow macros such as `capture()/reserve()/release()` where confirmed

### 1.2 Only explicit branches are materialized

A macro builder must create only the branches explicitly requested by the DSL configuration.

Example:

- if the builder configures request + granted handling, do not also generate rejected/revoked handling unless explicitly configured or required by the canonical mapped pattern.

### 1.3 Do not duplicate inherited contracts

If a document type already provides contracts through repo type inheritance, the DSL builder should not materialize duplicates unless runtime behavior proves explicit duplication is necessary.

### 1.4 Generated channels used by generated workflows must be trackable

Any auto-generated channel/contract used by generated workflows must participate in section tracking when the builder is used inside a section.

### 1.5 Deterministic keying

Generated contract keys must be deterministic.

Known global rules:

- operation implementation key: `<operationKey>Impl`
- init channel key: `initLifecycleChannel`
- triggered-event channel key: `triggeredEventChannel`

Stage-specific builders should follow a deterministic scheme that is stable across test runs.

## 2. Stage-3/4/5 materialization rules

### 2.1 `myOsAdmin(channelKey)` on non-admin document types

Materializes:

- `myOsAdminChannel` (or provided key)
- `myOsAdminUpdate`
- `myOsAdminUpdateImpl`

Purpose:

- allow MyOS Admin to deliver events into a non-admin-base document.

### 2.2 `access(...)`

Materializes, depending on configuration:

- one request-emission workflow
- zero or more response/control workflows (`granted`, `rejected`, `invalid`, `revoked`, etc.)
- optional follow-up subscription/request/call-operation workflows if the integration DSL asks for them

It does **not** blindly materialize every possible branch.
It materializes the orchestrated flows for the configured interaction pattern.

### 2.3 `accessLinked(...)`

Materializes, depending on configuration:

- one linked-documents permission request-emission workflow
- zero or more response/control workflows
- optional downstream steps following grant/control events

### 2.4 `agency(...)`

Materializes, depending on configuration:

- one worker-agency permission request-emission workflow
- zero or more response/control workflows
- optional worker-session start workflow once permission is granted

### 2.5 `ai(...).done()`

Materializes the AI orchestration scaffolding required by the mapped pattern.
Depending on configuration this may include:

- a permission-request workflow
- a granted -> subscribe workflow
- a subscription-ready workflow
- response matcher workflows
- status/context persistence fields or support workflows

### 2.6 `askAI(...)`

This is **not** a multi-contract builder.
It is a typed step helper that emits the correct request event shape inside an existing workflow.

### 2.7 `onAIResponse(...)`

Materializes a response-matcher workflow.
It may also prepend `_SaveAIContext` or equivalent context-persistence steps when that is part of the canonical mapped pattern.

## 3. Stage-6 materialization rules

## 3.1 Typed PayNote document builders are not macro-flow builders by default

The following builders primarily materialize a typed document and explicit fields:

- `PayNotes.payNote(name)`
- `PayNotes.cardTransactionPayNote(name)`
- `PayNotes.merchantToCustomerPayNote(name)` when supported
- `PayNotes.payNoteDelivery(name)`
- `PayNotes.paymentMandate(name)`

They should not duplicate inherited contracts by default.

## 3.2 `steps.paynote.*` and `steps.conversation.*` are typed step helpers, not macro-flow builders

These helpers materialize exactly one typed event/step payload inside an existing workflow.

Examples:

- `steps.paynote.reserveFundsRequested(...)`
- `steps.paynote.captureFundsRequested(...)`
- `steps.conversation.documentBootstrapRequested(...)`
- `steps.conversation.customerActionRequested(...)`

## 3.3 PayNote action-flow macros

Where Java exposes action-flow macros such as `capture()/reserve()/release()`, their materialization is defined here.

### General rule

These builders are **macro-flow builders**.
They may create:

- generated workflows,
- generated operation contracts,
- generated operation implementation workflows.

They do **not** create separate hidden runtimes.
They only materialize normal Conversation/MyOS/PayNote contracts using deterministic keys.

### `capture()` family

#### `lockOnInit()`

Materializes:

- one `Conversation/Sequential Workflow`
- channel: `initLifecycleChannel`
- one `Conversation/Trigger Event` step emitting:
  - `PayNote/Card Transaction Capture Lock Requested`

Recommended deterministic key:

- `captureLockOnInit`

#### `unlockOnEvent(<matcher>)`

Materializes:

- one `Conversation/Sequential Workflow`
- channel: `triggeredEventChannel`
- event matcher: `<matcher>`
- one `Conversation/Trigger Event` step emitting:
  - `PayNote/Card Transaction Capture Unlock Requested`

Recommended deterministic key pattern:

- `captureUnlockOn<MatcherToken>`

Runtime note:
- domyślna postać pozostaje poprawna dla eventów dostarczonych przez
  `triggeredEventChannel`,
- jeżeli workflow ma bezpośrednio słuchać zewnętrznego kanału timeline, należy
  użyć overloadu z `channelKey`.

An explicit overload may bind to a concrete channel instead:

- `unlockOnEvent(channelKey, <matcher>)`
- materializes the workflow on `channelKey`
- when `channelKey` is timeline-like, the matcher is adapted under `event.message`

#### `unlockOnOperation(operationKey, channelKey, description)`

Materializes:

- one `Conversation/Operation` named `operationKey`
- current public runtime subset: correction-cycle re-verification confirmed that requestless sequential workflow operations still do not match, so the generated operation must expose `request: { type: Boolean }`
- one `Conversation/Sequential Workflow Operation` named `<operationKey>Impl`
- implementation steps ending with a `Conversation/Trigger Event` step emitting:
  - `PayNote/Card Transaction Capture Unlock Requested`

#### `requestOnInit(amountExpr?)`

Materializes:

- one `Conversation/Sequential Workflow`
- channel: `initLifecycleChannel`
- one `Conversation/Trigger Event` step emitting:
  - `PayNote/Capture Funds Requested`
- amount defaults to `${document('/amount/total')}` unless explicitly overridden

Recommended deterministic key:

- `captureRequestOnInit`

#### `requestOnEvent(<matcher>, amountExpr?)`

Materializes:

- one `Conversation/Sequential Workflow`
- channel: `triggeredEventChannel`
- event matcher: `<matcher>`
- one `Conversation/Trigger Event` step emitting:
  - `PayNote/Capture Funds Requested`

An explicit overload may bind to a concrete channel instead:

- `requestOnEvent(channelKey, <matcher>, amountExpr?)`
- materializes the workflow on `channelKey`
- when `channelKey` is timeline-like, the matcher is adapted under `event.message`

Runtime note:
- default overload keeps the canonical `triggeredEventChannel` materialization,
- explicit-channel overloads are the runtime-confirmed path for direct external
  timeline-entry listeners.

#### `requestOnOperation(operationKey, channelKey, description, amountExpr?)`

Materializes:

- one `Conversation/Operation`
- current public runtime subset: correction-cycle re-verification confirmed that requestless sequential workflow operations still do not match, so the generated operation must expose `request: { type: Boolean }`
- one `<operationKey>Impl` workflow operation
- implementation steps ending with a trigger-event step emitting:
  - `PayNote/Capture Funds Requested`

Partial-request variants follow the same structure, including the explicit channel overload:

- `requestPartialOnEvent(channelKey, <matcher>, amountExpr)`

When `channelKey` is timeline-like, the matcher is adapted under `event.message`.
On the current public runtime the generated operation variants still must expose `request: { type: Integer }`.

### `reserve()` family

The same structural rules apply as for `capture()`, with the request/unlock event types swapped to the reserve equivalents confirmed by the current mapping references.

Reserve/release lock helpers remain unsupported on the current public runtime.

### `release()` family

The same structural rules apply as for `capture()`, with the emitted request event type swapped to the release equivalent confirmed by the current mapping references.

### Validation rule for lock/unlock macros

If an action macro configures `lockOnInit()`, at least one unlock path must also be configured before `buildDocument()`.

Acceptable unlock paths:

- `unlockOnEvent(...)`
- `unlockOnOperation(...)`
- another explicit unlock macro confirmed by the references

## 3.4 PayNote delivery decision flow

This is a canonical composed flow, even if implemented with generic Stage-2/Stage-6 helpers.

A delivery-decision flow typically materializes:

- the typed `PayNote/PayNote Delivery` document
- one or more user-facing operations already native to the type (`acceptPayNote`, `rejectPayNote`, etc.)
- optional workflows that emit:
  - `Conversation/Customer Action Requested`
  - `Conversation/Customer Action Responded`
  - `Conversation/Document Bootstrap Requested` / related bootstrap events

Important rule:

- if the document type already provides delivery operations, the DSL builder should not duplicate them.
- the flow composition happens around those existing operations and conversation events.

## 3.5 Payment mandate authorization / settlement flow

This is another canonical composed flow.

A mandate-spend orchestration typically materializes:

- the typed `PayNote/Payment Mandate` document
- request or response workflows that emit/consume:
  - `PayNote/Payment Mandate Spend Authorization Requested`
  - `PayNote/Payment Mandate Spend Settled`
- optional bootstrap/customer-action helpers if the app-level UX requires them and the references confirm the payloads

## 4. What is intentionally not auto-materialized

The following are **not** automatically generated just because a typed document builder is used:

- inherited repo contracts that the type already provides,
- every possible response/control branch of an interaction,
- ad-hoc application fields,
- backend-specific flows not confirmed by the mapping references.
