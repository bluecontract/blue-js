# BLUE TS DSL SDK — Stage 1 Specification

## Goal
Implement the first production-meaningful slice of the TypeScript DSL SDK from scratch in `libs/sdk-dsl`.
The stage-1 library should generate valid BLUE documents for the covered authoring flows and stay behaviorally close to the Java reference for those flows.

## Source of truth
Use these sources in this order:
1. `AGENTS.md`
2. `.cursor/rules/*.mdc` relevant to the DSL work
3. this document and the stage-1 testing strategy
4. Java docs and code under `references/java-sdk/**`
5. public APIs of `libs/language` and `libs/document-processor`

### Source-of-truth policy
- Java is the primary behavioral reference for all stage-1 in-scope features.
- The public TypeScript runtime is the final execution gate.
- If a proven conflict appears between Java parity and current runtime behavior, keep the runtime-correct behavior, document the mismatch in `stage-1-deviations.md`, and add a focused regression test.

## In scope
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
  - `.operation(key)` with builder methods:
    - `.channel(channelKey)`
    - `.description(text)`
    - `.requestType(typeInput)`
    - `.request(requestSchemaNodeOrBlueShapedObject)`
    - `.requestDescription(text)`
    - `.noRequest()`
    - `.steps(steps => ...)`
    - `.done()`

### StepsBuilder (stage 1)
- `.jsRaw(name, code)`
- `.replaceValue(name, path, value)`
- `.replaceExpression(name, path, expression)`
- `.triggerEvent(name, eventNode)`
- `.emit(name, blueShapedEventOrNode)`
- `.emitType(name, typeInput, payloadCustomizer?)` where the customizer mutates the event `BlueNode`
- `.raw(stepNode)`

### Build
- `.buildDocument()`

## Out of scope
- document-level handler methods (`onInit`, `onEvent`, `onNamedEvent`, `onDocChange`, `onChannelEvent`)
- `canEmit`
- MyOS / interactions
- access / linked access / agency
- AI
- PayNote
- patch / structure / generator pipeline
- dependency upgrades

## Required semantics
- `edit(existing)` mutates and returns the same `BlueNode`
- `from(existing)` clones before editing
- `expr('x')` -> `${x}`
- `expr('${x}')` remains unchanged
- unclosed section throws on `buildDocument()`
- section tracking records related fields and contracts and writes a `Conversation/Document Section` contract on `endSection()`
- operation implementation contract key is `<operationKey>Impl`
- operation builder can edit an existing operation and later add an implementation
- `.channel(name, contractLike)` can specialize or replace an existing channel contract
- `.noRequest()` removes request from an existing operation
- `.replaceExpression(...)` stores wrapped expressions
- `buildDocument()` returns the built node directly

## Type input model
Stage-1 type inputs must support:
- string alias
- `{ blueId: string }`
- `BlueNode`
- Zod schema with `typeBlueId` annotation from the public language annotation helpers

Implementation note:
- known repository-backed aliases such as `Integer`, `Conversation/Operation`, `Conversation/Event`, and `Conversation/Timeline Channel` are resolved to repository BlueIds during sdk-dsl authoring
- unknown custom aliases are preserved inline in the built node, but the current public runtime may reject them during preprocess; see `stage-1-deviations.md`

Stage-1 ordinary values and payload shapes must support:
- primitives
- arrays
- plain Blue-shaped objects
- `BlueNode`

Reflection-style Java bean serialization is explicitly out of scope in stage 1.

## Design constraints
- implement as a new library `libs/sdk-dsl`
- runtime must not depend on `document-processor`
- tests may use `document-processor`
- use only public imports from `@blue-labs/language`
- do not import from internal paths such as `@blue-labs/language/lib/...`
- keep workspace changes minimal
- do not upgrade dependency versions

## Java references to read first
### Main Java code
- `references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java`
- `references/java-sdk/src/main/java/blue/language/sdk/internal/StepsBuilder.java`

### Java docs
- `references/java-sdk/docs/sdk-dsl-developers.md`
- `references/java-sdk/docs/sdk-dsl-mapping-audit-reference.md`

### Java tests for stage 1
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DslParityAssertions.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderSectionsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/DocBuilderCounterIntegrationTest.java`

## Deliverables
- new library package in `libs/sdk-dsl`
- clean public export surface in `libs/sdk-dsl/src/index.ts`
- stage-1 docs updated to match implementation
- parity test helper
- stage-1 parity tests, guardrail tests, and counter integration test
- `docs/ts-dsl-sdk/stage-1-deviations.md` updated with any justified deviations
- `docs/ts-dsl-sdk/stage-1-coverage-matrix.md` updated with actual coverage

## Acceptance criteria
The stage is accepted only when:
1. stage-1 API is implemented
2. stage-1 tests pass
3. parity helper compares preprocessed canonical trees
4. counter integration test passes with TS `DocumentProcessor`
5. no internal `@blue-labs/language` imports were used
6. no dependency versions were upgraded
7. any deviation from Java is documented, justified, and covered by tests
