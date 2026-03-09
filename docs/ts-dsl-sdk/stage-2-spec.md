# BLUE TS DSL SDK — Stage 2 Specification

## Goal
Extend the existing stage-1 `libs/sdk-dsl` implementation with workflow handlers and richer step composition, while keeping stage-1 behavior intact and staying behaviorally close to the Java SDK for the stage-2 scope.

## Source of truth
1. `AGENTS.md`
2. relevant `.cursor/rules/*.mdc`
3. stage-1 docs where they still apply
4. this spec and `stage-2-testing-strategy.md`
5. Java references under `references/java-sdk/**`
6. public APIs of `libs/language` and `libs/document-processor`

Java remains the primary API and mapping reference.
The current public TypeScript runtime is the final execution gate.
When Java and runtime disagree, the SDK keeps the runtime-correct behavior, records the mismatch in `stage-2-deviations.md`, and adds a regression test.

## Implemented public APIs

### `DocBuilder`
- `.onInit(workflowKey, steps => ...)`
- `.onEvent(workflowKey, eventTypeInput, steps => ...)`
- `.onNamedEvent(workflowKey, eventName, steps => ...)`
- `.onDocChange(workflowKey, path, steps => ...)`
- `.onChannelEvent(workflowKey, channelKey, eventTypeInput, steps => ...)`

### `StepsBuilder`
- `.updateDocument(name, changeset => ...)`
- `.updateDocumentFromExpression(name, expression)`
- `.namedEvent(name, eventName)`
- `.namedEvent(name, eventName, payload => ...)`
- `.bootstrapDocument(stepName, documentNode, channelBindings)`
- `.bootstrapDocument(stepName, documentNode, channelBindings, options => ...)`
- `.bootstrapDocumentExpr(stepName, documentExpression, channelBindings, options?)`
- `.ext(factory)`

### Internal stage-2 helpers
- `ChangesetBuilder`
- `BootstrapOptionsBuilder`
- `NodeObjectBuilder`

## Implemented runtime mappings

### Handler contracts
- `onInit(...)` auto-creates `initLifecycleChannel` if missing.
- `initLifecycleChannel` is emitted as `Core/Lifecycle Event Channel` with channel-level event `Core/Document Processing Initiated`.
- `onInit(...)` writes a `Conversation/Sequential Workflow` bound to `initLifecycleChannel` and does not add a workflow-level event matcher.
- When `onInit(...)` is authored inside an open section, both `initLifecycleChannel` and the workflow key are added to that section's `relatedContracts`.

- `onEvent(...)` auto-creates `triggeredEventChannel` if missing.
- `triggeredEventChannel` is emitted as `Core/Triggered Event Channel`.
- `onEvent(...)` writes a `Conversation/Sequential Workflow` bound to `triggeredEventChannel` with a workflow-level `event` matcher resolved from the stage-1 `TypeInput` model.
- When `onEvent(...)` is authored inside an open section, both `triggeredEventChannel` and the workflow key are added to that section's `relatedContracts`.

- `onNamedEvent(...)` also reuses `triggeredEventChannel`.
- The workflow matcher event uses type `Common/Named Event`.
- When `onNamedEvent(...)` is authored inside an open section, both `triggeredEventChannel` and the workflow key are added to that section's `relatedContracts`.

- `onDocChange(...)` writes `<workflowKey>DocUpdateChannel` as `Core/Document Update Channel`.
- The generated channel stores the provided `path` string.
- The workflow is emitted as `Conversation/Sequential Workflow` bound to that generated channel with event type `Core/Document Update`.

- `onChannelEvent(...)` writes a `Conversation/Sequential Workflow` bound to the provided channel key and uses the provided stage-1 `TypeInput` as the workflow event matcher.
- The SDK does not silently replace the channel contract at that key.

### Step contracts
- `updateDocument(...)` emits `Conversation/Update Document` with an inline `changeset` array.
- `updateDocumentFromExpression(...)` emits `Conversation/Update Document` with an expression-valued `changeset`.
- `namedEvent(...)` emits `Conversation/Trigger Event` whose `event` node has type `Common/Named Event`, a required root-level `name`, and optional additional root-level event fields.
- `bootstrapDocument(...)` emits `Conversation/Trigger Event` with `event.type = Conversation/Document Bootstrap Requested`.
- `bootstrapDocumentExpr(...)` emits the same event type, but stores `document` as a wrapped `${...}` expression string.
- `ext(factory)` returns a custom extension bound to the current `StepsBuilder`.

## Type and value model

### Type input support
The following stage-1 `TypeInput` model is reused:
- string alias
- `{ blueId: string }`
- `BlueNode`
- Zod schema with a public `typeBlueId` annotation

### Value input support
Stage-2 payloads, bootstrap documents, changeset values, and matcher payloads support:
- primitives
- arrays
- plain BLUE-shaped JSON-like objects
- `BlueNode`

## Payload customizer shape
- `emitType(...)` now accepts a hybrid payload customizer object that keeps the old `BlueNode`-style mutators such as `.addProperty(...)` and also exposes Java-like helpers:
  - `.put(...)`
  - `.putNode(...)`
  - `.putExpression(...)`
  - `.putStringMap(...)`
- `namedEvent(...)` payload customizers and bootstrap payload building use the same internal object-builder implementation.

## Guardrails
- `namedEvent(...)` rejects blank event names.
- `bootstrapDocumentExpr(...)` rejects blank document expressions.
- `ChangesetBuilder` rejects blank paths.
- `ChangesetBuilder` rejects writes to reserved processor-managed contract paths:
  - `/contracts/checkpoint`
  - `/contracts/embedded`
  - `/contracts/initialized`
  - `/contracts/terminated`
- `ext(factory)` rejects null factories and null extension results.

## Out of scope
- `canEmit`
- `directChange`, change-policy DSL, proposal/accept/reject change helpers
- MyOS helper namespaces
- access / linked access / agency
- AI
- payments / PayNote / capture
- patch / structure / generator pipeline
- dependency upgrades

## Testing and acceptance
- stage-1 tests remain green
- stage-2 parity cases are ported/adapted from Java
- processor-backed runtime tests cover the required stage-2 flows
- all required verification commands pass

## Current deviations
- processor-managed Java shorthand aliases are emitted with runtime-correct `Core/*` aliases
- `onChannelEvent(...)` does not have a clean positive runtime path for timeline-message matchers through the current public processor API

See `stage-2-deviations.md` for the confirmed details and regression coverage.
