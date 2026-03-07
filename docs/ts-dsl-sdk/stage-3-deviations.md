# BLUE TS DSL SDK — Stage 3 deviations

Record only real, justified deviations.

## Entry format

### Title
- **Status:** open / accepted / resolved
- **Feature:** stage-3 feature name
- **Minimal DSL repro:**
```ts
// minimal repro here
```
- **Final mapping reference expectation:** quote the relevant section(s)
- **Java / legacy expectation:** optional, only if it differs
- **Runtime / actual behavior:**
- **Decision taken:**
- **Reason:**
- **Regression test:**
- **Follow-up:** optional

## Entries

### `myOsAdminUpdate` requires an explicit `List` request schema
- **Status:** accepted
- **Feature:** `DocBuilder.myOsAdmin(...)`
- **Minimal DSL repro:**
```ts
DocBuilder.doc()
  .myOsAdmin()
  .channel('myOsAdminChannel', { timelineId: 'admin-timeline' })
  .onEvent('onGranted', 'MyOS/Single Document Permission Granted', (steps) =>
    steps.replaceValue('SetStatus', '/status', 'granted'),
  );
```
- **Final mapping reference expectation:** section 5.1 allows omitting a materialized request schema when runtime does not require it.
- **Java / legacy expectation:** Java POC `myOsAdmin()` materialized a list-based request through the older `myOsEmit` helper shape.
- **Runtime / actual behavior:** current `document-processor` only executes `Conversation/Sequential Workflow Operation` when both the incoming request payload and the operation contract contain a `request` node that passes `isRequestTypeCompatible(...)`.
- **Decision taken:** `myOsAdmin()` now materializes `myOsAdminUpdate.request` as `type: List`.
- **Reason:** without an explicit request schema, the admin re-emission operation does not run at all.
- **Regression test:** `libs/sdk-dsl/src/__tests__/DocBuilder.myos.parity.test.ts` and `libs/sdk-dsl/src/__tests__/DocBuilder.myos.integration.test.ts`

### `requestId` matchers bind to `inResponseTo.requestId`
- **Status:** accepted
- **Feature:** `DocBuilder.onTriggeredWithId(...)`, `DocBuilder.onMyOsResponse(...)`
- **Minimal DSL repro:**
```ts
DocBuilder.doc()
  .onMyOsResponse(
    'onResponse',
    'MyOS/Call Operation Responded',
    'REQ_1',
    (steps) => steps.replaceValue('SetSeen', '/seen', true),
  );
```
- **Final mapping reference expectation:** sections 5.2 and 5.5 define MyOS response/control wrappers with correlation stored under `inResponseTo`, including optional `requestId`.
- **Java / legacy expectation:** Java POC also populated a top-level `requestId` field in the matcher for `onTriggeredWithId(..., 'requestId', ...)`.
- **Runtime / actual behavior:** current repo-native response wrappers are matched reliably through `inResponseTo.requestId`; top-level `requestId` is not the canonical response correlation location.
- **Decision taken:** `requestId`-based helpers now match only `inResponseTo.requestId`.
- **Reason:** this follows the final mapping reference and the runtime-confirmed MyOS response envelopes.
- **Regression test:** `libs/sdk-dsl/src/__tests__/DocBuilder.myos.parity.test.ts` and `libs/sdk-dsl/src/__tests__/DocBuilder.myos.integration.test.ts`

### `grantSessionSubscriptionOnResult` is intentionally unsupported
- **Status:** accepted
- **Feature:** `steps.myOs().singleDocumentPermissionGrantRequested(...)`
- **Minimal DSL repro:**
```ts
new StepsBuilder()
  .myOs()
  .singleDocumentPermissionGrantRequested(
    'ownerChannel',
    'session-42',
    {
      type: 'MyOS/Single Document Permission Set',
      read: true,
    },
    {
      requestId: 'REQ_1',
      // grantSessionSubscriptionOnResult: true // intentionally unsupported
    },
  );
```
- **Final mapping reference expectation:** section 5.2 does not include `grantSessionSubscriptionOnResult` on `MyOS/Single Document Permission Grant Requested`.
- **Java / legacy expectation:** Java POC exposed and emitted `grantSessionSubscriptionOnResult`.
- **Runtime / actual behavior:** the field is not present in current `@blue-repository/types`, is not part of `SingleDocumentPermissionGrantRequestedSchema`, and is not runtime-confirmed in `lcloud-develop`.
- **Decision taken:** Stage 3 does not materialize this field and does not keep it in the typed helper surface.
- **Reason:** this is legacy Java-PoC drift outside the final source of truth.
- **Regression test:** `libs/sdk-dsl/src/__tests__/StepsBuilder.myos.test.ts`

### Subscribe-to-session helper follows the final runtime schema
- **Status:** accepted
- **Feature:** `steps.myOs().subscribeToSessionRequested(...)`
- **Minimal DSL repro:**
```ts
new StepsBuilder()
  .myOs()
  .subscribeToSessionRequested('session-42', 'SUB_ALL');
```
- **Final mapping reference expectation:** section 5.4 says `MyOS/Subscribe to Session Requested` does not include `onBehalfOf`, and `subscription.events == undefined` means "match all".
- **Java / legacy expectation:** Java POC `subscribeToSession(...)` accepted `onBehalfOf` and defaulted `subscription.events` to an empty list.
- **Runtime / actual behavior:** current repo schema has no `onBehalfOf` field on subscribe requests, and an empty `subscription.events` list means "match none" rather than "match all".
- **Decision taken:** the Stage 3 helper omits `onBehalfOf` entirely and omits `subscription.events` when no filters are provided.
- **Reason:** this preserves runtime-correct subscribe semantics instead of copying the older Java convenience shape.
- **Regression test:** `libs/sdk-dsl/src/__tests__/StepsBuilder.myos.test.ts`
