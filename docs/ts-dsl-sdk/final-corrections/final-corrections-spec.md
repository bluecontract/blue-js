# Final corrections spec

## Goal
Resolve the last known correctness/semantics mismatches after the main uplift so the SDK sits as close to 10/10 as practical.

## Confirmed decisions from product/runtime review

### 1. Named Event
- `@blue-repository/types@0.21.0` contains `Common/Named Event`
- named-event mapping should use `Common/Named Event`
- fields live on the event root
- there should be no fallback mapping to `Conversation/Event`
- AI named-event matching should use real named-event support

### 2. Core aliases
- use canonical prefixed aliases such as `Core/*`
- Java shorthand aliases are not the target output

### 3. onChannelEvent
- this is not an inherent runtime limitation
- workflows may declare:
  - `channel: <timeline channel>`
  - `event: <event/message matcher>`
- the processor unwraps the timeline entry and matches the underlying event/message type
- positive runtime proof should exist

### 4. myOsAdminUpdate
- `request: List` is the correct schema
- keep it

### 5. Request correlation
- requestId correlation should use `inResponseTo.requestId`
- keep it

### 6. Unsupported items
Keep unsupported/deferred:
- `grantSessionSubscriptionOnResult`
- reserve/release lock helpers
- `requestBackwardPayment(...)` until public runtime/types confirm it

### 7. subscribeToCreatedSessions(true)
- must be unsupported/fail-fast
- do not leave it as a silent no-op

### 8. PayNote operation-triggered branches
- correction-cycle re-verification showed that the current public runtime still
  requires explicit request schemas for operation-triggered PayNote macro
  branches
- keep executable `Boolean` / `Integer` request schemas until the runtime
  actually accepts requestless sequential workflow operations

### 9. Stage 6 event-driven channels
- defaulting to `triggeredEventChannel` is fine where appropriate
- the DSL should also allow explicit listening channel selection for event-driven macro branches

## Out of scope
- external-consumer proof
- migration validation in lcloud
- `myos-js` transport/API intake
