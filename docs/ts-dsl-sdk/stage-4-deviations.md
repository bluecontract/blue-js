# BLUE TS DSL SDK — Stage 4 deviations

Record only real, justified Stage 4 deviations.

## Entry format

### Title
- **Status:** open / accepted / resolved
- **Feature:** stage-4 feature name
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

### `subscribeToCreatedSessions(true)` is unsupported and fails fast
- **Status:** accepted
- **Feature:** `DocBuilder.access(...).subscribeToCreatedSessions(...)`
- **Minimal DSL repro:**
```ts
DocBuilder.doc()
  .access('catalog')
  .targetSessionId('session-42')
  .onBehalfOf('ownerChannel')
  .subscribeToCreatedSessions(true)
  .done();
```
- **Final mapping reference expectation:** sections 5.2 and 5.4 do not define `grantSessionSubscriptionOnResult` or another runtime-confirmed "subscribe to created sessions" field on `MyOS/Single Document Permission Grant Requested`.
- **Java / legacy expectation:** the Java POC exposed `.subscribeToCreatedSessions(true)` and materialized `grantSessionSubscriptionOnResult: true`.
- **Runtime / actual behavior:** current repo schemas do not expose that field and Stage 3 already established that `grantSessionSubscriptionOnResult` is unsupported by current runtime types.
- **Decision taken:** the builder method remains for fluent-shape compatibility, but calling it with `true` throws immediately instead of silently generating an incomplete request shape.
- **Reason:** fail-fast behavior is clearer and safer than a compatibility no-op when the current public runtime does not support the legacy field.
- **Regression test:** `libs/sdk-dsl/src/__tests__/DocBuilder.interactions.parity.test.ts`

### Single-document and linked-document revoke requests use the minimal runtime schema
- **Status:** accepted
- **Feature:** `steps.access(...).revokePermission(...)`, `steps.myOs().revokeSingleDocPermission(...)`, `steps.myOs().revokeLinkedDocsPermission(...)`
- **Minimal DSL repro:**
```ts
new StepsBuilder()
  .myOs()
  .revokeSingleDocPermission('REQ_1', {
    reason: 'closed',
  });
```
- **Final mapping reference expectation:** sections 5.2 and 5.3 describe revoke control events correlated by `requestId`; current repo runtime schemas expose `requestId` and optional `reason`, but not extra request-context fields.
- **Java / legacy expectation:** the Java POC carried more contextual revoke fields, including flow-specific request data.
- **Runtime / actual behavior:** current `@blue-repository/types` revoke-request schemas do not include `targetSessionId` or `onBehalfOf`.
- **Decision taken:** Stage 4 emits only `requestId` and optional `reason` for revoke requests.
- **Reason:** adding non-schema fields would create payloads that are not confirmed by the current runtime.
- **Regression test:** `libs/sdk-dsl/src/__tests__/StepsBuilder.myos.test.ts`, `libs/sdk-dsl/src/__tests__/DocBuilder.interactions.parity.test.ts`

### Access subscription-ready state matches direct initiated/failed events
- **Status:** accepted
- **Feature:** `DocBuilder.access(...).subscribeAfterGranted()`
- **Minimal DSL repro:**
```ts
DocBuilder.doc()
  .access('catalog')
  .targetSessionId('session-42')
  .onBehalfOf('ownerChannel')
  .subscribeAfterGranted()
  .done();
```
- **Final mapping reference expectation:** sections 5.4 and 8.2 allow access flows to react to direct subscription lifecycle events keyed by top-level `subscriptionId`.
- **Java / legacy expectation:** parts of the Java POC modeled post-subscribe handling through `MyOS/Subscription Update`.
- **Runtime / actual behavior:** the current runtime emits `MyOS/Subscription to Session Initiated` and `MyOS/Subscription to Session Failed` directly, and they are the cleanest processor-visible hooks for access state transitions.
- **Decision taken:** Stage 4 materializes direct triggered-event matchers for initiated/failed events, both filtered by top-level `subscriptionId`.
- **Reason:** matching the direct runtime events avoids extra wrapper assumptions and keeps the flow executable today.
- **Regression test:** `libs/sdk-dsl/src/__tests__/DocBuilder.interactions.parity.test.ts`, `libs/sdk-dsl/src/__tests__/DocBuilder.interactions.integration.test.ts`

### Start-worker-session request uses the runtime envelope, not the Java-PoC `config` wrapper
- **Status:** accepted
- **Feature:** `steps.viaAgency(...).startSession(...)`, `steps.myOs().startWorkerSession(...)`
- **Minimal DSL repro:**
```ts
new StepsBuilder()
  .viaAgency('procurement')
  .startSession(
    'StartWorker',
    { name: 'Purchase' },
    (bindings) => bindings.bind('sellerChannel', 'vendor@example.com'),
    (options) => options.defaultMessage('Started'),
  );
```
- **Final mapping reference expectation:** sections 5.8 and 5.10 place `document`, `channelBindings`, `initialMessages`, and `capabilities` directly on `MyOS/Start Worker Session Requested`.
- **Java / legacy expectation:** the Java POC used a nested `config` object and additional legacy fields such as `initiatorChannel`.
- **Runtime / actual behavior:** current runtime shapes use the top-level envelope, and worker-session startup is executable only with that layout.
- **Decision taken:** Stage 4 emits the top-level runtime envelope and leaves the legacy `config` wrapper absent.
- **Reason:** this is the runtime-confirmed request shape in the current repo and mapping documents.
- **Regression test:** `libs/sdk-dsl/src/__tests__/StepsBuilder.myos.test.ts`, `libs/sdk-dsl/src/__tests__/DocBuilder.interactions.parity.test.ts`, `libs/sdk-dsl/src/__tests__/DocBuilder.interactions.integration.test.ts`
