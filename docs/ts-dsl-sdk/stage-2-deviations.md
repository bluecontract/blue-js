# BLUE TS DSL SDK — Stage 2 Deviations

## Processor `Core/*` aliases replace Java shorthand channel and event aliases
- **Status:** accepted

### Minimal DSL repro
```ts
DocBuilder.doc()
  .onInit('initialize', steps =>
    steps.replaceValue('SetReady', '/status', 'ready'))
  .onDocChange('whenPriceChanges', '/price', steps =>
    steps.replaceValue('SetStatus', '/status', 'updated'))
  .buildDocument();
```

### Java / reference expectation
- Java parity fixtures and tests use shorthand aliases such as:
  - `Lifecycle Event Channel`
  - `Triggered Event Channel`
  - `Document Update Channel`
  - `Document Update`
  - `Document Processing Initiated`

### Runtime / actual behavior
- The current public TypeScript repo/runtime resolves only the canonical `Core/*` aliases for these processor-managed contracts and events.
- The Java shorthand aliases are not publicly resolvable in the current TypeScript repository metadata.

### Decision
- The SDK emits:
  - `Core/Lifecycle Event Channel`
  - `Core/Triggered Event Channel`
  - `Core/Document Update Channel`
  - `Core/Document Update`
  - `Core/Document Processing Initiated`

### Rationale
- Using the Java shorthand aliases would produce invalid or non-executable documents in the current TypeScript runtime.
- This is a direct runtime-compatibility requirement, not a stylistic TypeScript choice.

### Confirming tests
- `libs/sdk-dsl/src/__tests__/DocBuilder.general.parity.test.ts`
  - `matches onEvent parity`
  - `matches onDocChange parity with runtime channel and event aliases`
  - `matches onInit parity with runtime lifecycle aliases`

## `Common/Named Event` is not publicly resolvable in the current repo packages
- **Status:** accepted

### Minimal DSL repro
```ts
DocBuilder.doc()
  .onNamedEvent('onReady', 'READY', steps =>
    steps.replaceValue('SetStatus', '/status', 'ready'))
  .buildDocument();
```

### Java / reference expectation
- Java maps named events to a resolvable `Common/Named Event` type.
- Java parity YAML expresses that type directly as a normal alias.

### Runtime / actual behavior
- The current public repository packages do not expose a canonical public mapping for `Common/Named Event`.
- The runtime can still execute named-event workflows if both emitted events and matchers use the same unresolved inline type node.

### Decision
- The SDK emits named-event matchers and named-event trigger payloads with an unresolved inline `Common/Named Event` type node.
- The parity helper uses a parity-only supplemental repository alias so canonical structural comparison can still preprocess and compare those documents.
- Processor-backed runtime tests use the real runtime Blue setup without that parity-only alias.

### Rationale
- This preserves runtime-correct behavior without inventing a fake public production alias in the SDK itself.
- It also keeps the Java intent visible instead of silently remapping named events to a different runtime type.

### Confirming tests
- `libs/sdk-dsl/src/__tests__/DocBuilder.general.parity.test.ts`
  - `matches onNamedEvent parity using the runtime-compatible named-event type node`
- `libs/sdk-dsl/src/__tests__/DocBuilder.handlers.integration.test.ts`
  - `reacts to emitted named events via onNamedEvent workflows`
- `libs/sdk-dsl/src/__tests__/DocBuilder.steps.parity.test.ts`
  - `builds the stage-2 step primitives and emit helpers`
  - `supports custom step extensions`

## `onChannelEvent(...)` positive runtime coverage is blocked by current public timeline-channel dispatch semantics
- **Status:** accepted

### Minimal DSL repro
```ts
DocBuilder.doc()
  .channel('ownerChannel', {
    type: 'Conversation/Timeline Channel',
    timelineId: 'owner-timeline-42',
  })
  .onChannelEvent(
    'onOwnerMessage',
    'ownerChannel',
    'Conversation/Chat Message',
    steps => steps.replaceValue('SetStatus', '/status', 'seen'),
  )
  .buildDocument();
```

### Java / reference expectation
- Java stage-2 parity treats `onChannelEvent(...)` as a workflow bound to the supplied channel key with the supplied event matcher type.
- The intended runtime expectation is that a channel event whose message matches the supplied type can trigger that workflow.

### Runtime / actual behavior
- The current public `Conversation/Timeline Channel` processor channelizes external events as the full `Conversation/Timeline Entry`.
- It does not expose a clean public dispatch path that re-matches the handler against `event.message`.
- A workflow matcher of `Conversation/Chat Message` therefore does not fire when processing a timeline entry whose `message` is a chat message.

### Decision
- The SDK keeps the Java-compatible contract shape for `onChannelEvent(...)`.
- Stage 2 keeps parity coverage for that contract shape.
- Instead of faking a positive runtime harness, the suite records the current runtime limitation with a regression test.

### Rationale
- Rewriting the DSL contract shape to compensate for current processor internals would drift from Java without a stable public runtime contract to target.
- The prompt explicitly allows parity-only coverage when the public processor API does not support a clean runtime exercise.

### Confirming tests
- `libs/sdk-dsl/src/__tests__/DocBuilder.channels.parity.test.ts`
  - `matches onChannelEvent parity`
- `libs/sdk-dsl/src/__tests__/DocBuilder.handlers.integration.test.ts`
  - `preserves the current runtime limitation for onChannelEvent message matchers on timeline channels`
