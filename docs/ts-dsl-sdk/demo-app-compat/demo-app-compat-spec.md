# Demo-app compatibility uplift spec

## Goal
Make the current mainline `libs/sdk-dsl` close enough to the local demo-app DSL surface that migration is mostly a local source replacement + integration pass, not a broad syntax rewrite.

## Scope
### In
- compatibility exports (`BasicBlueTypes`, `JsonObject`, `JsonValue`, `toOfficialJson`, optional `toOfficialYaml`)
- document marker/link/anchor convenience wrappers
- AI alias helpers (`onAIResponseForTask`, `onAINamedResponse`)
- MyOS/session convenience aliases where semantically faithful (`onSessionCreated`, `onLinkedDocGranted`)
- `MyOsPermissions` convenience builder
- `steps.myOs().subscribeToSessionWithMatchers(...)`
- tests and docs for the above

### Out
- changing accepted final mappings
- transport/API/client logic
- `requestBackwardPayment(...)` enablement
- `myos-js` companion intake

## Acceptance bar
- additive compatibility only
- no regression in existing runtime-backed scenarios
- all verification green

## Final delivered compatibility surface
- `BasicBlueTypes`, `JsonObject`, `JsonValue`, `toOfficialJson(...)`, and
  `toOfficialYaml(...)` are available as compatibility exports.
- `toOfficialJson(...)` and `toOfficialYaml(...)` are thin compatibility names
  over the existing alias-style/simple export path. They do not change the
  Stage 1–7 structural oracle, which still uses preprocess + `official` JSON in
  tests.
- `sessionInteraction(...)`, `participantsOrchestration(...)`, and
  `workerAgency(...)` are thin marker-contract wrappers over `contract(...)`.
- `documentAnchors(...)`, `documentLinks(...)`, `sessionLink(...)`,
  `documentLink(...)`, and `documentTypeLink(...)` are thin conveniences over
  the existing marker/link contract shapes. `sessionLink(...)`,
  `documentLink(...)`, and `documentTypeLink(...)` support cumulative insertion
  into the same `links` contract.
- `onAIResponseForTask(...)` and `onAINamedResponse(...)` delegate to the
  existing `onAIResponse(...)` matching machinery.
- `onSessionCreated(...)` is a convenience alias for listening to the
  runtime-confirmed `MyOS/Subscription to Session Initiated` event after access
  configuration validation.
- `onLinkedDocGranted(...)` listens for the concrete linked-document
  notification event `MyOS/Single Document Permission Granted`.
- `onLinkedDocRejected(...)` and `onLinkedDocRevoked(...)` are optional
  compatibility aliases over the linked-documents permission lifecycle helpers
  `onLinkedAccessRejected(...)` and `onLinkedAccessRevoked(...)`.
- `MyOsPermissions.create()` is a thin authored-permission helper. Its
  demo-app-style `.write(...)` method maps to the runtime-confirmed `share`
  field used by current repository types and mappings.
- `steps.myOs().subscribeToSessionWithMatchers(...)` is a thin alias over
  `subscribeToSessionRequested(...)` with `events` matcher arrays.
- `steps.myOs().subscribeToSession(...)` and
  `steps.myOs().subscribeToSessionWithMatchers(...)` intentionally do not accept
  or materialize `onBehalfOf`, because `MyOS/Subscribe to Session Requested`
  does not support it in the final runtime shape.
- `onChannelEvent(...)` keeps the runtime-confirmed distinction:
  timeline-like channels match under `event.message`, while non-timeline
  channels match directly on `event`.
