# Stage roadmap

This roadmap turns the master plan into implementation stages with explicit outputs and acceptance criteria.

## Stage A — Ergonomics and public export surfaces

Status:
- completed

### Scope
- public alias-style JSON export:
  - `buildJson()` and/or `nodeToAliasJson(...)`
- public raw-contract helper:
  - `contract(key, contractLike)`
  - optional `contracts(record)`
- tests and docs for both

### Why this stage first
This removes the biggest migration pain from real external usage and gives immediate API value without changing runtime behavior.

### Acceptance
- external consumers no longer need a local alias-JSON normalization helper
- external consumers no longer need `field('/contracts/...')` for common contract insertion
- tests prove section tracking for inserted contracts
- docs updated

### Delivered on mainline
- public `nodeToAliasJson(...)`
- builder-level `buildJson()`
- `contract(key, contractLike)`
- `contracts(record)`
- regression coverage for alias export semantics, section tracking, and inherited builder surfaces

---

## Stage B — Generic authoring helpers and parity surface

Status:
- completed

### Scope
- `SimpleDocBuilder`
- change lifecycle helpers:
  - `contractsPolicy(...)`
  - `directChange(...)`
  - `proposeChange(...)`
  - `acceptChange(...)`
  - `rejectChange(...)`
- generic wrappers:
  - `anchors(...)`
  - `links(...)`
  - `canEmit(...)`

### Acceptance
- parity tests added or adapted
- runtime proofs added where applicable
- public docs explain runtime-confirmed deviations vs Java where needed

### Delivered on mainline
- `SimpleDocBuilder`
- `contractsPolicy(...)`
- `directChange(...)`
- `proposeChange(...)`
- `acceptChange(...)`
- `rejectChange(...)`
- `anchors(...)`
- `links(...)`
- `canEmit(...)`
- parity coverage for generic builder, change lifecycle, marker/link helpers, and `canEmit(...)`
- runtime coverage for `directChange(...)` and `canEmit(...)`

---

## Stage C — Payment / conversation convenience APIs

Status:
- completed

### Scope
- thin convenience APIs confirmed by mapping/runtime, for example:
  - `triggerPayment(...)`
  - `requestBackwardPayment(...)`
- other low-level convenience wrappers that reduce unnecessary raw fallbacks

### Acceptance
- new APIs are thin, documented, and runtime-confirmed
- tests cover both shape and runtime behavior
- no duplication with existing macro builders

### Delivered on mainline
- `StepsBuilder.triggerPayment(...)`
- `StepsBuilder.requestBackwardPayment(...)`
- public `PaymentRequestPayloadBuilder` with rail-specific builder chains and `ext(...)`
- parity coverage for payment payload fields, guardrails, and extension hooks
- runtime proof that `triggerPayment(...)` emits runtime-processed payment events from init workflows
- explicit runtime guard for the currently unavailable `PayNote/Backward Payment Requested` repository alias

---

## Stage D — Macro-builder hardening with canonical scenarios

Status:
- completed

### Scope
Add stronger real-world proof for:
- `access(...)`
- `accessLinked(...)`
- `agency(...)`
- `ai(...).done()`
- `askAI(...)`
- `onAIResponse(...)`
- PayNote macro builders

### Acceptance
- each major macro surface has:
  - parity test
  - integration/runtime test
  - canonical-scenario proof
- raw fallbacks are reduced where the DSL can express the behavior cleanly

### Delivered on mainline
- richer `steps.accessLinked(...)` composition:
  - request permission
  - call
  - subscribe
  - revoke
- richer `steps.viaAgency(...)` composition:
  - request permission
  - call
  - subscribe
  - revoke
  - worker-session start
- agency configuration now supports `targetSessionId(...)` for session-oriented helper composition
- canonical PayNote macro proof for the capture lifecycle
- full parity / runtime / canonical coverage remains green for:
  - access
  - linked access
  - agency
  - AI orchestration
  - PayNote macros

---

## Stage E — Architecture and maintainability uplift

Status:
- completed

### Scope
- split monolithic builder files
- isolate domain-specific internals
- preserve public API

### Acceptance
- no public API regressions
- internals are cleaner and easier to change
- tests remain green

### Delivered on mainline
- interaction-domain nested builders moved out of `doc-builder.ts` into:
  - `doc-builder-interaction-builders.ts`
- interaction-domain step helpers moved out of `steps-builder.ts` into:
  - `interaction-step-builders.ts`
- `StepsBuilder` now composes those domain modules instead of carrying all interaction helper implementations inline
- public exports and runtime behavior stayed unchanged while verification and canonical scenarios remained green

---

## Stage F — Optional `myos-js` companion intake

Status:
- deferred

### Scope
If the donor reference exists and is high quality:
- evaluate `libs/myos-js`
- import as separate package or companion module
- add docs/examples for interop with `sdk-dsl`

### Acceptance
- `myos-js` remains separate from `sdk-dsl` runtime
- integration points are documented
- if not imported, deferment is documented clearly

### Delivered on mainline
- donor evaluation completed against the alternative `libs/myos-js`
- intake deferred because the donor is a transport/API client SDK with:
  - HTTP resources and request-option layering
  - OpenAPI-generated types and operation catalogs
  - live-environment test and credential gating
- existing `sdk-dsl` needs are already covered by the current builder-input compatibility documented by the donor
- no runtime or authoring gap inside `sdk-dsl` justified importing a separate companion package into this uplift

---

## Stage G — Final release hardening

### Scope
- final docs refresh
- examples refresh
- scorecard closure
- final QA sweep

### Acceptance
- all categories reach 9–10/10
- docs match behavior
- no unresolved critical regressions
