# Final corrections decisions matrix

| Item | Final classification | Target action |
|---|---|---|
| `Common/Named Event` | supported | implement fully using `@blue-repository/types@0.21.0` |
| `Core/*` aliases | accepted adaptation | keep canonical prefixed aliases |
| `onChannelEvent(...)` | supported | add positive runtime proof, remove limitation wording |
| `myOsAdminUpdate.request = List` | accepted adaptation | keep |
| `requestId -> inResponseTo.requestId` | accepted adaptation | keep |
| `grantSessionSubscriptionOnResult` | deferred/unsupported | keep unsupported |
| `subscribeToCreatedSessions(true)` | unsupported | fail fast, do not no-op |
| minimal revoke request shape | accepted adaptation | keep minimal confirmed shape |
| direct initiated/failed transitions | accepted adaptation | keep |
| start-worker-session runtime envelope | accepted adaptation | keep |
| AI named-event runtime limitation | obsolete if Named Event is supported | remove once implemented |
| TS `{ namedEvent: string }` | accepted TS adaptation | keep |
| reserve/release lock helpers | deferred/unsupported | keep deferred |
| operation-triggered PayNote branch typed requests | to be rechecked | prefer omitted `request` if runtime-correct |
| `requestBackwardPayment(...)` | deferred/runtime-guarded | keep guarded until public runtime/types support it |
| event-driven Stage 6 explicit channel support | to be verified/expanded | support default + explicit channel semantics |
