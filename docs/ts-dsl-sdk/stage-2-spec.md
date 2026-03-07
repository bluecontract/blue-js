# BLUE TS DSL SDK — Stage 2 Specification

## Goal
Extend the stage-1 TypeScript DSL SDK with workflow handler authoring and richer step composition, while preserving stage-1 behavior and keeping the implementation close to the Java SDK for the stage-2 feature set.

## Stage relationship
- Stage 1 remains the foundation and must stay green.
- Stage 2 adds workflow-level authoring and reusable step-building primitives.
- Stage 3+ features such as MyOS helper DSL, AI, payments, PayNote, and patch/structure remain out of scope.

## Source of truth
Use these sources in this order:
1. `AGENTS.md`
2. `.cursor/rules/*.mdc` relevant to the DSL work
3. stage-1 docs where they still apply
4. this stage-2 spec and stage-2 testing strategy
5. Java docs and code under `references/java-sdk/**`
6. public APIs of `libs/language` and `libs/document-processor`

### Source-of-truth policy
- Java is the primary behavioral reference for all stage-2 in-scope features.
- The public TypeScript runtime is the final execution gate.
- If a proven conflict appears between Java parity and current runtime behavior, keep the runtime-correct behavior, document the mismatch in `stage-2-deviations.md`, and add a focused regression test.

## In scope
### `DocBuilder` handler authoring
- `.onInit(workflowKey, steps => ...)`
- `.onEvent(workflowKey, eventTypeInput, steps => ...)`
- `.onNamedEvent(workflowKey, eventName, steps => ...)`
- `.onDocChange(workflowKey, path, steps => ...)`
- `.onChannelEvent(workflowKey, channelKey, eventTypeInput, steps => ...)`

### `StepsBuilder` extensions
- `.updateDocument(name, changeset => ...)`
- `.updateDocumentFromExpression(name, expression)`
- `.namedEvent(name, eventName)`
- `.namedEvent(name, eventName, payload => ...)`
- `.bootstrapDocument(stepName, documentNode, channelBindings)`
- `.bootstrapDocument(stepName, documentNode, channelBindings, options => ...)`
- `.bootstrapDocumentExpr(stepName, documentExpression, channelBindings, options => ...)`
- `.ext(factory)`

### Nested / internal helper builders
- `ChangesetBuilder`
  - `.replaceValue(path, value)`
  - `.replaceExpression(path, expression)`
  - `.addValue(path, value)`
  - `.remove(path)`
- `BootstrapOptionsBuilder`
  - `.assignee(channelKey)`
  - `.defaultMessage(text)`
  - `.channelMessage(channelKey, text)`
- internal payload/object builder used by:
  - `namedEvent(...)`
  - `bootstrapDocument(...)`
  - `bootstrapDocumentExpr(...)`

## Out of scope
- `canEmit`
- `directChange`, `contractsPolicy`, `proposeChange`, `acceptChange`, `rejectChange`
- MyOS admin helper surface and MyOS-specific step namespaces
- access / linked access / agency
- AI
- payment request builders
- PayNote
- patch / structure / generator pipeline
- dependency upgrades

## Required semantics
### Handler contracts
- `onInit(...)` auto-creates or reuses `initLifecycleChannel`
- `initLifecycleChannel` should be a lifecycle event channel matching document processing initiated
- `onEvent(...)` auto-creates or reuses `triggeredEventChannel`
- `onNamedEvent(...)` auto-creates or reuses `triggeredEventChannel`
- `onDocChange(...)` auto-creates or reuses `<workflowKey>DocUpdateChannel`
- `onChannelEvent(...)` binds the workflow to the provided channel key and event matcher

### Expected handler shapes
- `onInit(...)` produces a `Conversation/Sequential Workflow` bound to `initLifecycleChannel`
- `onEvent(...)` produces a `Conversation/Sequential Workflow` bound to `triggeredEventChannel` with an `event` matcher
- `onNamedEvent(...)` produces a `Conversation/Sequential Workflow` bound to `triggeredEventChannel` with a named-event matcher
- `onDocChange(...)` produces:
  - a generated document update channel contract
  - a `Conversation/Sequential Workflow` bound to that channel
  - an event matcher compatible with document update events if required by runtime
- `onChannelEvent(...)` produces a `Conversation/Sequential Workflow` bound to the provided channel

### Named-event rule
- Prefer the canonical repository/runtime named-event type if available.
- If the current repo/runtime requires a different but compatible event shape, keep runtime-correct behavior and document it in stage-2 deviations.
- Blank event names are invalid.

Implementation note:
- the current branch emits a `Common/Named Event`-shaped node for stage-2 named-event helpers
- named-event parity/runtime coverage uses the stronger preprocess + `official` JSON oracle, but named-event-specific expected artifacts are built programmatically because the current TypeScript YAML parser reserves the key `name`

### Update-document rule
- `updateDocument(...)` produces a `Conversation/Update Document` step with an inline `changeset` array.
- `updateDocumentFromExpression(...)` produces a `Conversation/Update Document` step whose `changeset` is an expression string.

### Changeset guardrails
- blank paths are invalid
- reserved processor-relative paths are forbidden
- at minimum, protect the equivalents of:
  - `/_checkpoint`
  - `/_embedded`
  - `/_initialized`
  - `/_terminated`
- if public processor constants for these paths are unavailable, locally mirror the reserved path list with a short comment

### Bootstrap-document rule
- `bootstrapDocument(...)` emits `Conversation/Document Bootstrap Requested`
- `bootstrapDocumentExpr(...)` emits the same event but uses an expression-valued `document`
- channel bindings are serialized as a string-keyed dictionary
- options may populate:
  - `bootstrapAssignee`
  - `initialMessages.defaultMessage`
  - `initialMessages.perChannel`

### Extension hook rule
- `ext(factory)` returns a custom extension object bound to the current `StepsBuilder`
- null factory is invalid
- a factory that returns null is invalid
- the extension hook is generic stage-2 infrastructure, not a payment or AI feature

### Runtime note for `onChannelEvent(...)`
- parity coverage is required
- runtime coverage is optional only if the public processor API supports clean external channel-event delivery for the stage-2 matcher shape
- if not, keep parity coverage and document the limitation

## Type input model
Stage-2 handler matcher type inputs should support the same stage-1 type-input model:
- string alias
- `{ blueId: string }`
- `BlueNode`
- Zod schema with public `typeBlueId` annotation

Stage-2 payload and changeset values should support the same stage-1 ordinary value model:
- primitives
- arrays
- plain Blue-shaped objects
- `BlueNode`

## Design constraints
- work on the existing `libs/sdk-dsl` library
- preserve stage-1 APIs and behavior
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
- `references/java-sdk/src/main/java/blue/language/sdk/internal/ChangesetBuilder.java`
- `references/java-sdk/src/main/java/blue/language/sdk/internal/BootstrapOptionsBuilder.java`
- `references/java-sdk/src/main/java/blue/language/sdk/internal/NodeObjectBuilder.java`

### Java docs
- `references/java-sdk/docs/sdk-dsl-developers.md`
- `references/java-sdk/docs/sdk-dsl-mapping-audit-reference.md`

### Java tests for stage 2
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DslParityAssertions.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderStepsDslParityTest.java`

## Deliverables
- existing `libs/sdk-dsl` extended with stage-2 APIs
- clean public export surface in `libs/sdk-dsl/src/index.ts`
- stage-2 docs updated to match implementation
- stage-2 parity tests, guardrail tests, and runtime integration tests
- `docs/ts-dsl-sdk/stage-2-deviations.md` updated with any justified deviations
- `docs/ts-dsl-sdk/stage-2-coverage-matrix.md` updated with actual coverage

## Acceptance criteria
The stage is accepted only when:
1. stage-1 tests still pass
2. stage-2 API is implemented
3. stage-2 tests pass
4. required runtime scenarios pass with TS `DocumentProcessor`
5. no internal `@blue-labs/language` imports were used
6. no dependency versions were upgraded unless already intentionally upgraded in the target branch
7. any deviation from Java is documented, justified, and covered by tests
