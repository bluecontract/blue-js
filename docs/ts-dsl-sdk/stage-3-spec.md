# BLUE TS DSL SDK — Stage 3 spec

## Purpose

Stage 3 adds the **MyOS/admin/session-interaction foundation** on top of the generic DSL built in Stage 1 and Stage 2.

This stage is intentionally narrower than the full Java SDK surface. It focuses on the smallest useful MyOS interaction layer that can be validated end-to-end with the existing processor.

## Primary mapping reference

Stage 3 must be implemented against:

- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`

This document is the implementation-ready mapping reference for:
- Conversation payload/event shapes,
- MyOS admin and session-interaction flows,
- bootstrap-related semantics,
- channel and wrapper decisions.

Java POC remains useful for:
- fluent API shape,
- naming,
- builder ergonomics,
- scenario discovery,
- parity intent.

When Java POC and the final mapping reference disagree on MyOS/Conversation platform shapes, the final mapping reference wins.

## Mapping sections relevant to Stage 3

Use these sections directly:
- 2.1 explicit channels in runtime documents
- 2.3 no `Common/Named Event` in current repo
- 3.4 pending actions and customer interactions
- 3.5 bootstrap-related Conversation events
- 4.3 `MyOS/MyOS Timeline Channel`
- 4.5 `Core/Triggered Event Channel`
- 5.1 `MyOS/MyOS Admin Base`
- 5.2 session interaction wrappers
- 5.4 subscribe-to-session and subscription update envelope
- 5.5 call-operation request and response forwarding
- 5.9 `MyOS/Document Session Bootstrap`
- 8.1 Stage 3 implications

## Scope

### In scope

#### DocBuilder helpers
- `myOsAdmin()`
- `myOsAdmin(channelKey)`
- `onTriggeredWithId(...)`
- `onTriggeredWithMatcher(...)`
- `onSubscriptionUpdate(...)`
- `onMyOsResponse(...)`

#### StepsBuilder helpers
- `steps.myOs()` / `MyOsSteps`
- helper builders for:
  - `singleDocumentPermissionGrantRequested(...)`
  - `subscribeToSessionRequested(...)`
  - `callOperationRequested(...)`

#### Tests and docs
- stage-3 parity tests
- stage-3 runtime integration tests
- stage-3 docs / coverage / deviation tracking

### Out of scope

- `access()`
- `accessLinked()`
- `agency()`
- AI builders and AI workflows
- payment helpers and PayNote implementation
- patch/editing compiler work
- worker agency / participant orchestration / linked-doc grant orchestration helpers

## Core semantics

### `myOsAdmin(...)`
This helper must materialize the standard admin-delivery contracts required when a document needs to receive admin-delivered events but is **not** typed as `MyOS/MyOS Admin Base`.

The resulting document should include the runtime-confirmed manual admin shape from mapping-reference section 5.1:
- `myOsAdminChannel`
- `myOsAdminUpdate`
- `myOsAdminUpdateImpl`

The helper must not silently overwrite the root document `type`.
If the document already uses `type: MyOS/MyOS Admin Base`, do not duplicate inherited contracts unless explicitly asked.

Ergonomic overload:
- `myOsAdmin(channelKey)` is supported and rewires `myOsAdminUpdate.channel` to the provided contract key
- `myOsAdmin()` remains the standard mapping-ref shorthand for `myOsAdminChannel`

Current runtime note:
- `myOsAdminUpdate` must carry `request: { type: List }` in the current processor build, otherwise the operation does not execute.
- this is recorded as a Stage 3 deviation because mapping-reference section 5.1 only says the request schema is optional when runtime does not require it.

### Triggered-event matchers
These helpers must generate deterministic workflows bound to `Core/Triggered Event Channel` and apply the matching constraints required by the processor/runtime.

They must align to the mapped MyOS wrappers and update envelopes, especially:
- `MyOS/Subscription Update`
- `MyOS/Call Operation Responded`
- related `inResponseTo` correlation shapes

Current runtime-correct matcher decisions:
- `onTriggeredWithId(..., 'subscriptionId', ...)` matches top-level `subscriptionId`
- `onTriggeredWithId(..., 'requestId', ...)` matches nested `inResponseTo.requestId`
- `onMyOsResponse(...)` is a thin convenience wrapper over the same `inResponseTo.requestId` correlation rule

### `MyOsSteps`
This namespace should provide convenience builders for the standard MyOS request events used by session-interaction flows.

These builders are not independent new concepts. They are thin typed wrappers over runtime-correct MyOS events emitted through the Stage 2 trigger/emit mechanisms.

Implemented helper surface:
- `steps.myOs().singleDocumentPermissionGrantRequested(...)`
- `steps.myOs().subscribeToSessionRequested(...)`
- `steps.myOs().callOperationRequested(...)`

Current runtime-correct subscribe semantics:
- the helper does not expose Java POC `onBehalfOf` for subscribe-to-session because the final mapping reference and current repo schema do not include it
- when no event filters are provided, the helper omits `subscription.events` entirely so runtime semantics remain "match all"

Unsupported Java-PoC-only field:
- `grantSessionSubscriptionOnResult` is intentionally not part of the Stage 3 runtime shape for `MyOS/Single Document Permission Grant Requested`

## Exit criteria

Stage 3 is complete when:
- the stage-3 APIs exist,
- their parity coverage is in place,
- runtime integration proves real behavior,
- stage-1/stage-2 behavior is not regressed,
- deviations are explicit and justified,
- the implementation is aligned to the final mapping reference.
