# Final corrections decisions matrix

| Item | Final classification | Target action |
|---|---|---|
| `Common/Named Event` | supported | use the real repo type with instance `name` and root-level fields |
| `Core/*` aliases | accepted adaptation | keep canonical prefixed aliases |
| `onChannelEvent(...)` | supported | keep positive runtime proof and timeline-channel matcher wrapping |
| `myOsAdminUpdate.request = List` | accepted adaptation | keep |
| `requestId -> inResponseTo.requestId` | accepted adaptation | keep |
| `grantSessionSubscriptionOnResult` | deferred/unsupported | keep unsupported |
| `subscribeToCreatedSessions(true)` | unsupported | fail fast, do not no-op |
| minimal revoke request shape | accepted adaptation | keep minimal confirmed shape |
| direct initiated/failed transitions | accepted adaptation | keep |
| start-worker-session runtime envelope | accepted adaptation | keep |
| AI named-event runtime limitation | resolved | remove the old deviation and keep positive runtime proof |
| TS `{ namedEvent: string }` | accepted TS adaptation | keep |
| reserve/release lock helpers | deferred/unsupported | keep deferred |
| operation-triggered PayNote branch typed requests | resolved | omit `request` when the generated operation should accept arbitrary or empty payloads |
| `requestBackwardPayment(...)` | deferred/runtime-guarded | keep guarded until public runtime/types support it |
| event-driven Stage 6 explicit channel support | supported | keep default + explicit channel semantics |
