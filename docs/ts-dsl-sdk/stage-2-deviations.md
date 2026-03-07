# BLUE TS DSL SDK — Stage 2 Deviations

Record only real, justified stage-2 deviations here.

## Template

### Title
- **Status:** planned / active / accepted / blocked / resolved

### Minimal DSL repro
```ts
// minimal repro here
```

### Java / reference expectation
- describe the Java behavior or mapping reference

### Runtime / actual behavior
- describe the current TypeScript runtime-correct behavior

### Decision
- what the TS SDK implements

### Rationale
- why this deviation is necessary or acceptable

### Regression test
- test file and test name

---

## Current known placeholders

### Named-event parity uses programmatic expected nodes instead of YAML fixtures
- **Status:** accepted

### Minimal DSL repro
```ts
DocBuilder.doc()
  .onNamedEvent('onReady', 'READY', steps =>
    steps.replaceValue('SetReady', '/status', 'ready'))
  .buildDocument();
```

### Java / reference expectation
- Java parity fixtures express named events naturally in YAML with:
  - `type: Common/Named Event`
  - `name: READY`

### Runtime / actual behavior
- the current TypeScript YAML parser treats `name` as reserved node metadata, not as an ordinary property key
- this makes a raw YAML fixture for `Common/Named Event` ambiguous or incorrect for the stronger preprocess + `official` JSON oracle

### Decision
- sdk-dsl still emits the stage-2 named-event shape
- named-event-specific parity cases use the same preprocess + `official` JSON + BlueId oracle, but the expected side is built programmatically as a `BlueNode` instead of parsed from YAML

### Rationale
- this keeps the parity oracle strong without weakening named-event coverage
- it avoids pretending that the current TypeScript YAML parser can faithfully encode a property literally named `name`

### Regression test
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.workflows.parity.test.ts` — `matches onNamedEvent parity`
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.steps.parity.test.ts` — `matches namedEvent helper parity with and without payload`

---

### `onChannelEvent(...)` does not yet have a clean public runtime integration path
- **Status:** accepted

### Minimal DSL repro
```ts
DocBuilder.doc()
  .channel('ownerChannel')
  .onChannelEvent('onIncrement', 'ownerChannel', 'Integer', steps =>
    steps.replaceValue('SetCounter', '/counter', 1))
  .buildDocument();
```

### Java / reference expectation
- Java parity models `onChannelEvent(...)` as a workflow bound to an existing channel with a simple event-type matcher

### Runtime / actual behavior
- the current public TypeScript processor delivers timeline-channel events as full channelized timeline entries
- a clean runtime test would require a richer matcher shape against the timeline entry payload than the stage-2 `eventTypeInput` API is meant to model

### Decision
- keep strong parity coverage for `onChannelEvent(...)`
- defer processor-backed runtime coverage for this API until a later stage or a runtime-compatible matcher surface is intentionally introduced

### Rationale
- this preserves the requested stage-2 API shape without widening scope into richer matcher builders
- the limitation is made explicit instead of faking a misleading runtime test

### Regression test
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.workflows.parity.test.ts` — `matches onChannelEvent parity`
