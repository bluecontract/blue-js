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
