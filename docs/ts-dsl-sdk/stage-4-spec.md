# BLUE TS DSL SDK — Stage 4 spec

## Purpose

Stage 4 adds the higher-level MyOS interaction DSL on top of:
- Stage 1 document authoring,
- Stage 2 workflows and richer step composition,
- Stage 3 MyOS/admin/session-interaction foundations.

The stage-4 layer exposes named builders for permission, linked-access, and worker-agency flows so callers do not need to hand-assemble the same MyOS request/control flows repeatedly.

## Primary sources of truth

Stage 4 is implemented against:
- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`
- `docs/ts-dsl-sdk/complex-flow-materialization-reference.md`

Java references remain secondary and are used for:
- public API shape,
- nested builder ergonomics,
- naming,
- scenario discovery,
- parity intent.

When Java POC and the final mapping docs disagree, the final mapping docs plus runtime-confirmed behavior win.

## Mapping sections used directly

- 2.1 explicit channels in runtime documents
- 2.2 `requestId`
- 2.4 inherited contracts vs explicit duplication
- 3.4 pending actions and customer interactions
- 4.3 `MyOS/MyOS Timeline Channel`
- 5.1 `MyOS/MyOS Admin Base`
- 5.2 single-document permission request/response/control events
- 5.3 linked-documents permission request/response/control events
- 5.4 subscription wrappers where needed by access flows
- 5.5 call-operation request/response forwarding where needed by access flows
- 5.6 anchors and links
- 5.8 worker agency
- 5.10 canonical grant document patterns
- 8.2 Stage 4 implications

## Implemented public API

### `DocBuilder`

#### `access(accessName)`
Returns a nested builder with:
- `.targetSessionId(value)`
- `.onBehalfOf(channelKey)`
- `.read(boolean)`
- `.operations(...operationKeys)`
- `.statusPath(path)`
- `.subscribeAfterGranted()`
- `.subscriptionEvents(...eventTypes)`
- `.subscribeToCreatedSessions(enabled)`
- `.requestPermissionOnInit()`
- `.requestPermissionOnEvent(eventType)`
- `.requestPermissionOnDocChange(path)`
- `.requestPermissionManually()`
- `.done()`

Materialized behavior:
- ensures `myOsAdmin()` support contracts exist,
- registers deterministic request/subscription ids,
- materializes the permission-request workflow unless permission timing is manual,
- materializes granted/rejected/revoked handlers,
- when `.subscribeAfterGranted()` is enabled, materializes follow-up subscribe and subscription-ready / subscription-failed handlers.

#### `accessLinked(linkedAccessName)`
Returns a nested builder with:
- `.targetSessionId(value)`
- `.onBehalfOf(channelKey)`
- `.statusPath(path)`
- `.link(anchorKey)` returning:
  - `.read(boolean)`
  - `.operations(...operationKeys)`
  - `.done()`
- `.requestPermissionOnInit()`
- `.requestPermissionOnEvent(eventType)`
- `.requestPermissionOnDocChange(path)`
- `.requestPermissionManually()`
- `.done()`

Materialized behavior:
- ensures `myOsAdmin()` support contracts exist,
- requires at least one link,
- builds a runtime-correct `MyOS/Linked Documents Permission Set`,
- materializes request/granted/rejected/revoked workflows.

#### `agency(agencyName)`
Returns a nested builder with:
- `.onBehalfOf(channelKey)`
- `.allowedTypes(...typeInputs)`
- `.allowedOperations(...operationKeys)`
- `.statusPath(path)`
- `.requestPermissionOnInit()`
- `.requestPermissionOnEvent(eventType)`
- `.requestPermissionOnDocChange(path)`
- `.requestPermissionManually()`
- `.done()`

Materialized behavior:
- ensures `myOsAdmin()` support contracts exist,
- materializes the `workerAgency` marker contract,
- materializes worker-agency request/granted/rejected/revoked workflows,
- uses runtime-correct `allowedWorkerAgencyPermissions`.

#### Convenience workflow wrappers

Implemented thin wrappers over Stage 3 matcher helpers:
- `onAccessGranted(...)`
- `onAccessRejected(...)`
- `onAccessRevoked(...)`
- `onUpdate(...)`
- `onCallResponse(...)`
- `onLinkedAccessGranted(...)`
- `onLinkedAccessRejected(...)`
- `onLinkedAccessRevoked(...)`
- `onAgencyGranted(...)`
- `onAgencyRejected(...)`
- `onAgencyRevoked(...)`
- `onSessionStarting(...)`
- `onSessionStarted(...)`
- `onSessionFailed(...)`
- `onParticipantResolved(...)`
- `onAllParticipantsReady(...)`

These helpers delegate to the Stage 3 triggered-event machinery and keep request-correlation semantics aligned to the mapping reference.

### `StepsBuilder`

#### Access / agency namespaces

- `steps.access(accessName)` exposes:
  - `.requestPermission(stepName?)`
  - `.call(operation, request)`
  - `.callExpr(operation, expression)`
  - `.subscribe(stepName?)`
  - `.revokePermission(stepName?)`

- `steps.viaAgency(agencyName)` exposes:
  - `.requestPermission(stepName?)`
  - `.startSession(stepName, document, bindings?, options?)`

#### Extended `steps.myOs()`

Stage 4 extends the Stage 3 `MyOsSteps` namespace with:
- `.requestLinkedDocsPermission(...)`
- `.revokeSingleDocPermission(...)`
- `.revokeLinkedDocsPermission(...)`
- `.grantWorkerAgencyPermission(...)`
- `.revokeWorkerAgencyPermission(...)`
- `.startWorkerSession(...)`

Stage 3 helpers remain available and are reused rather than reimplemented.

## Core runtime semantics

- Stage 4 builders compose Stage 3 primitives instead of bypassing them.
- Root document `type` remains unchanged; admin/support contracts are additive.
- Generated contracts are still tracked by sections when builders are used inside an open section.
- `requestId` remains the correlation mechanism for permission and response flows.
- Access subscription-ready state uses direct triggered events confirmed by the current runtime.
- Worker-session requests use the runtime envelope from the mapping docs, not the older Java nested `config` shape.

## Known limitations

Stage 4 keeps several runtime-first deviations from the Java POC. They are documented in `stage-4-deviations.md` and covered by regression tests rather than hidden behind fake parity.

## Exit criteria

Stage 4 is complete when:
- stage-4 APIs are implemented on top of Stages 1–3,
- mapping-reference-derived parity scenarios are covered,
- processor-backed interaction scenarios are green,
- Stage 1–3 behavior remains green,
- Stage 4 docs and matrices reflect the real implementation,
- real deviations are documented explicitly.
