# BLUE TS DSL SDK — Stage 1 Specification

## Goal
Implement the first production-meaningful TypeScript BLUE DSL library in `libs/sdk-dsl`.
Stage 1 is complete when the library is behaviorally close to the Java SDK for the in-scope flows and produces BLUE documents that execute in the current public TypeScript runtime for the covered integration path.

## Source of truth
1. `AGENTS.md`
2. `.cursor/rules/*.mdc` relevant to the DSL work
3. this document and `testing-strategy.md`
4. Java docs and code under `references/java-sdk/**`
5. public APIs of `libs/language` and `libs/document-processor`

### Source-of-truth policy
- Java is the primary reference for public API shape, naming, and fluent behavior.
- The public TypeScript runtime is the execution gate.
- When Java parity conflicts with the current runtime for an in-scope feature, keep the runtime-correct behavior, document the mismatch in `stage-1-deviations.md`, and lock it with a test.

## Implemented scope
### Entry points
- `DocBuilder.doc()`
- `DocBuilder.edit(existingNode)`
- `DocBuilder.from(existingNode)`
- `DocBuilder.expr(expression)`

### Core document metadata
- `.name(...)`
- `.description(...)`
- `.type(typeInput)`

### Field authoring
- `.field(path, value)`
- `.field(path)` returning a field builder with:
  - `.type(typeInput)`
  - `.description(text)`
  - `.value(value)`
  - `.required(boolean)`
  - `.minimum(number)`
  - `.maximum(number)`
  - `.done()`
- `.replace(path, value)`
- `.remove(path)`

### Channel authoring
- `.channel(name)`
- `.channel(name, contractLike)`
- `.channels(...names)`
- `.compositeChannel(name, ...channelKeys)`

### Sections
- `.section(key)`
- `.section(key, title, summary)`
- `.endSection()`

### Operations
- inline overloads:
  - `.operation(key, channel, description)`
  - `.operation(key, channel, requestType, description)`
  - `.operation(key, channel, description, steps => ...)`
  - `.operation(key, channel, requestType, description, steps => ...)`
- builder form:
  - `.operation(key)` with:
    - `.channel(channelKey)`
    - `.description(text)`
    - `.requestType(typeInput)`
    - `.request(requestSchemaNodeOrBlueShapedObject)`
    - `.requestDescription(text)`
    - `.noRequest()`
    - `.steps(steps => ...)`
    - `.done()`

### StepsBuilder
- `.jsRaw(name, code)`
- `.replaceValue(name, path, value)`
- `.replaceExpression(name, path, expression)`
- `.triggerEvent(name, eventNode)`
- `.emit(name, blueShapedEventOrNode)`
- `.emitType(name, typeInput, payloadCustomizer?)`
- `.raw(stepNode)`

### Build
- `.buildDocument()`

## Out of scope
- `onInit`, `onEvent`, `onNamedEvent`, `onDocChange`, `onChannelEvent`
- `canEmit`
- MyOS / interactions
- access / linked access / agency
- AI
- PayNote
- patch / structure / generator pipeline
- dependency upgrades

## Preserved semantics
- `DocBuilder.edit(existing)` mutates and returns the same `BlueNode`.
- `DocBuilder.from(existing)` clones before editing and returns a different `BlueNode`.
- `DocBuilder.expr('x')` returns `${x}`.
- `DocBuilder.expr('${x}')` remains `${x}`.
- `buildDocument()` throws when a section is still open with the Java-equivalent message.
- Section tracking records related field pointers and contract keys and materializes `Conversation/Document Section` on `endSection()`.
- `.channel(name, contractLike)` can specialize an existing channel contract at the same key.
- Operation implementation contract keys use the `<operationKey>Impl` suffix.
- Operation builder editing supports existing operation contracts and later implementation creation.
- `.request(...)` stores the request schema under `contracts/<operation>/request`.
- `.noRequest()` removes the request when editing an existing operation.
- `.replaceExpression(...)` stores a wrapped `${...}` expression.
- `.emitType(...)` creates a `Conversation/Trigger Event` step with a typed event node.
- `buildDocument()` returns the working `BlueNode` directly.

## Type and value model
### Supported `typeInput`
- string aliases such as `Integer` or `Conversation/Event`
- `{ blueId: string }`
- `BlueNode`
- Zod schemas annotated with public `typeBlueId` helpers

### Implemented resolution behavior
- Known string aliases are normalized through a repository-backed `Blue` instance.
- Unknown string aliases are preserved as inline type nodes and are not rejected by the DSL.
- Runtime preprocessing still requires repository support for unknown aliases. See `stage-1-deviations.md`.

### Supported values
- primitives
- arrays
- plain objects
- `BlueNode`

### Conversion notes
- General value conversion uses public `Blue` JSON-like conversion so processor-facing documents keep runtime-compatible scalar and contract typing.
- Operation request-schema objects use a local schema converter so Java shapes like `{ type: 'List', items: [...] }` become `request.type` plus an `items` property, matching Java request-schema parity.
- Field constraints are serialized as a `constraints` child node because the public TS node API does not expose Java’s `Constraints` model mutators directly.

## Implemented internal kernel
- repository-backed type resolver
- supported value-to-node conversion helpers
- request-schema conversion helper
- JSON pointer write/remove helpers
- contracts map helper
- section tracker
- operation state applicator
- parity helper
- processor-backed test harness

## Design constraints
- The library lives in `libs/sdk-dsl`.
- Runtime code does not depend on `document-processor`.
- Tests may use `document-processor`.
- Only public `@blue-labs/language` imports are used.
- No dependency versions were upgraded.
- Workspace changes stay local to the new library and stage-1 docs.

## Java references used
### Main Java code
- `references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java`
- `references/java-sdk/src/main/java/blue/language/sdk/internal/StepsBuilder.java`

### Java docs
- `references/java-sdk/docs/sdk-dsl-developers.md`
- `references/java-sdk/docs/sdk-dsl-mapping-audit-reference.md`

### Java tests
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DslParityAssertions.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderSectionsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/DocBuilderCounterIntegrationTest.java`

## Deliverables
- `libs/sdk-dsl` library package with public exports in `src/index.ts`
- internal stage-1 kernel helpers
- parity helper and processor harness
- parity, unit, and integration tests for stage 1
- updated mapping, testing, deviation, and coverage docs

## Acceptance criteria
1. The stage-1 public API is implemented.
2. Stage-1 parity, unit, and counter integration tests pass.
3. The parity helper preprocesses both documents and compares canonical structural JSON.
4. Counter integration passes through the public TypeScript `DocumentProcessor`.
5. No internal `@blue-labs/language` imports are used.
6. No dependency versions were upgraded.
7. Any justified deviation is documented and covered by tests.
