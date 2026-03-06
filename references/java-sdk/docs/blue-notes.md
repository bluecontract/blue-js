# Blue Spec Alignment Notes (internal)

## 1) Operation Request model

Operations are invoked through timeline messages carrying:

- operation name
- request payload
- target document reference

Reference shape:

```yaml
message:
  type: Conversation/Operation Request
  operation: <operationName>
  request: <payload>
  document:
    blueId: ...
```

SDK implication:

- operation DSL should expose request typing (`requestType(...)`) for clarity and runtime safety.
- participant ingress can be modeled as operation-based event pass-through:
  - `acceptsEventsFrom("participant")`
  - `acceptsEventsFrom("participant", AllowedEventA.class, AllowedEventB.class)`

## 2) Contract typing and channels

Channel contracts are type-driven:

- `Core/Channel`
- `Conversation/Timeline Channel` (subtype)
- `MyOS/MyOS Timeline Channel` (subtype)

SDK implication:

- default participants should be abstract timeline channels.
- concrete identities should be introduced in bootstrap bindings or explicit overlays.

## 3) Trigger patterns supported

Important patterns used by the SDK:

- lifecycle-triggered workflows (`Core/Document Processing Initiated`)
- event-triggered workflows (`Core/Triggered Event Channel`)
- document-change-triggered workflows (`Core/Document Update Channel`)
- operation workflows (`Conversation/Sequential Workflow Operation`)

SDK implication:

- expose one-liner helpers for common trigger patterns (capture lock/unlock, reserve/capture, refund/release, child issuance).
- canonical capture API should follow `{action}On{Trigger}` shape only (no duplicate alias naming surface).

## 4) Policies

Contracts-change policies can restrict broad mutation operations by path allow-lists.

SDK implication:

- `directChangeWithAllowList(...)` should be first-class for controlled mutation flows.

## 5) Deterministic JS

Structured JS builder output should avoid non-deterministic constructs.

SDK implication:

- use `JsProgram` + `JsOutputBuilder` + `JsPatchBuilder` + `JsArrayBuilder` + `JsObjectBuilder`.
- keep examples deterministic for testability.
- use placeholder-safe JS templates (`{{TOKEN}}`) via:
  - `steps.jsTemplate(...)`
  - `JsProgram.Builder.linesTemplate(...)`
  - with fail-fast unknown token detection.

## 6) Triggered payment event authoring

`triggerPayment(...)` payloads should be authored with typed builder methods for base fields:

- `processor(...)`
- `payer(...)`
- `payee(...)`
- `currency(...)`
- `amountMinor(...)`
- `attachPayNote(...)`

Subtype-specific methods (ACH/SEPA/wire/card/token/credit-line/internal-ledger/crypto) should be additive and deterministic.
