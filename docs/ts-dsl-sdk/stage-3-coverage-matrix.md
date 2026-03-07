# BLUE TS DSL SDK — Stage 3 coverage matrix

| Construct | Parity test | Runtime test | Deviation doc | Status | Notes |
|---|---:|---:|---:|---|---|
| `myOsAdmin(...)` | `DocBuilder.myos.parity.test.ts` | `DocBuilder.myos.integration.test.ts` | `stage-3-deviations.md#myosadminupdate-requires-an-explicit-list-request-schema` | Done | Root document type stays unchanged; overload `myOsAdmin(channelKey)` is also covered in parity |
| `onTriggeredWithId(...)` | `DocBuilder.myos.parity.test.ts` | `DocBuilder.myos.integration.test.ts` via `onMyOsResponse(...)` and subscription flows | `stage-3-deviations.md#requestid-matchers-bind-to-inresponsetorequestid` | Done | `subscriptionId` is top-level; `requestId` is nested correlation |
| `onTriggeredWithMatcher(...)` | `DocBuilder.myos.parity.test.ts` | N/A | none | Done | Generic matcher node builder over `Core/Triggered Event Channel` |
| `onSubscriptionUpdate(...)` | `DocBuilder.myos.parity.test.ts` | `DocBuilder.myos.integration.test.ts` | none | Done | Covered for both typed and untyped update filters |
| `onMyOsResponse(...)` | `DocBuilder.myos.parity.test.ts` | `DocBuilder.myos.integration.test.ts` | `stage-3-deviations.md#requestid-matchers-bind-to-inresponsetorequestid` | Done | Runtime test uses `MyOS/Call Operation Responded` wrapper |
| `steps.myOs()` entry | `StepsBuilder.myos.test.ts` | `DocBuilder.myos.integration.test.ts` | none | Done | Namespace entry only; no extra orchestration helpers added |
| SDPG request helper | `StepsBuilder.myos.test.ts` | N/A | `stage-3-deviations.md#grantsessionsubscriptiononresult-is-intentionally-unsupported` | Done | Shape covered directly; unsupported Java-PoC field is asserted absent |
| subscribe-to-session helper | `StepsBuilder.myos.test.ts` | `DocBuilder.myos.integration.test.ts` through subscription flow composition | `stage-3-deviations.md#subscribe-to-session-helper-follows-the-final-runtime-schema` | Done | Default helper behavior is "match all" by omitting `subscription.events` |
| call-operation helper | `StepsBuilder.myos.test.ts` | `DocBuilder.myos.integration.test.ts` | none | Done | Used both in non-admin interaction flow and the counter vertical slice |
| bootstrap-aligned interaction foundations | `DocBuilder.steps.parity.test.ts` | `DocBuilder.handlers.integration.test.ts` | none | Done | Stage 3 composes with existing Stage 2 bootstrap helpers and `myOsAdminChannel` assignee semantics |
| non-admin session-interaction flow | N/A | `DocBuilder.myos.integration.test.ts` | none | Done | Explicit regression that root `type` remains `Custom/Type` while admin/session flow still works |
| stage-1/stage-2 regression verification | existing Stage 1/2 suites | existing Stage 1/2 suites | none | Done | Full `sdk-dsl` Vitest suite stays green with 67 tests |
