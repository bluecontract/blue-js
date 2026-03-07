# BLUE TS DSL SDK — Stage 3 mapping matrix

Use this file as the implementation and mapping checklist.

Primary mapping source for all rows below:
- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`

| Feature | Final mapping reference | Java reference role | TS API / helper | Expected contracts / nodes | Tests | Status | Notes |
|---|---|---|---|---|---|---|---|
| `myOsAdmin(...)` | 5.1, 4.3 | `DocBuilderGeneralDslParityTest.myOsAdminMatchesYamlDefinition` plus runtime scenario discovery | `DocBuilder.myOsAdmin()` | `myOsAdminChannel` + `myOsAdminUpdate` + `myOsAdminUpdateImpl` | `DocBuilder.myos.parity.test.ts`, `DocBuilder.myos.integration.test.ts` | Done | Root type unchanged; runtime currently requires `request: { type: List }` on `myOsAdminUpdate` |
| `onTriggeredWithId(...)` | 4.5, 5.2, 5.4, 5.5 | `DocBuilderGeneralDslParityTest.onTriggeredWithIdMatchesYamlDefinition` | `DocBuilder.onTriggeredWithId(...)` | triggered workflow with id-based matcher on triggered channel | `DocBuilder.myos.parity.test.ts` | Done | `requestId` maps to `inResponseTo.requestId`; `subscriptionId` maps top-level |
| `onTriggeredWithMatcher(...)` | 4.5, 5.2 | `DocBuilderGeneralDslParityTest.onTriggeredWithMatcherMatchesYamlDefinition` | `DocBuilder.onTriggeredWithMatcher(...)` | triggered workflow with matcher object | `DocBuilder.myos.parity.test.ts` | Done | Root matcher object is converted to a `BlueNode` and forced to the requested event type |
| `onSubscriptionUpdate(...)` | 5.4, 4.5 | `DocBuilderGeneralDslParityTest.onSubscriptionUpdateWithTypeMatchesYamlDefinition`, `...WithoutType...` | `DocBuilder.onSubscriptionUpdate(...)` | triggered workflow matching `MyOS/Subscription Update` + subscription id + optional `update.type` | `DocBuilder.myos.parity.test.ts`, `DocBuilder.myos.integration.test.ts` | Done | Typed update matcher uses nested `update` event pattern |
| `onMyOsResponse(...)` | 5.5, 4.5 | `DocBuilderGeneralDslParityTest.onMyOsResponseWithRequestIdMatchesYamlDefinition`, `...WithoutRequestId...` | `DocBuilder.onMyOsResponse(...)` | triggered workflow matching MyOS response forwarding wrapper / correlation shape | `DocBuilder.myos.parity.test.ts`, `DocBuilder.myos.integration.test.ts` | Done | Runtime coverage uses `MyOS/Call Operation Responded` wrapper |
| `steps.myOs()` / `MyOsSteps` | 8.1 | `DocBuilderMyOsDslParityTest.myOsStepsMethodsProduceExpectedEventContracts` as scenario source | `steps.myOs()` | namespace entry | `StepsBuilder.myos.test.ts` | Done | Thin wrappers only; no bootstrap / worker / participant helpers added in Stage 3 |
| SDPG request helper | 5.2 | `DocBuilderMyOsDslParityTest.myOsStepsMethodsProduceExpectedEventContracts` | `steps.myOs().singleDocumentPermissionGrantRequested(...)` | `MyOS/Single Document Permission Grant Requested` event | `StepsBuilder.myos.test.ts` | Done | Supports optional `requestId` and `grantSessionSubscriptionOnResult` |
| subscribe-to-session helper | 5.4 | `DocBuilderMyOsDslParityTest.myOsStepsMethodsProduceExpectedEventContracts` | `steps.myOs().subscribeToSessionRequested(...)` | `MyOS/Subscribe to Session Requested` event | `StepsBuilder.myos.test.ts` | Done | Omits `subscription.events` when no filters are provided; no Java-style `onBehalfOf` |
| call-operation helper | 5.5 | `DocBuilderMyOsDslParityTest.myOsStepsMethodsProduceExpectedEventContracts` | `steps.myOs().callOperationRequested(...)` | `MyOS/Call Operation Requested` event | `StepsBuilder.myos.test.ts`, `DocBuilder.myos.integration.test.ts` | Done | Omits `request` when input is `null` / `undefined` |
| bootstrap-aligned interaction foundations | 3.5, 5.9 | Context only | compose with existing Stage 2 bootstrap helpers | Stage 3 helpers must not contradict bootstrap mapping | `DocBuilder.handlers.integration.test.ts`, `DocBuilder.steps.parity.test.ts` | Done | Stage 3 reuses existing Stage 2 bootstrap helpers rather than adding a second bootstrap abstraction |
| non-admin session-interaction example | 5.1, 5.2, 5.4, 5.5, 8.1 | `DocBuilderInteractionsDslParityTest` as scenario source | composed DSL scenario | root type unchanged + admin helper contracts + runtime flow | `DocBuilder.myos.integration.test.ts` | Done | Also covered by the two-document counter/session-interaction vertical slice |

## Notes

- Use exact Java file paths once the relevant references are identified.
- If a Java stage-3 feature conflicts with the final mapping reference, record the deviation in `stage-3-deviations.md`.
