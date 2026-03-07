# BLUE TS DSL SDK — Stage 2 Testing Strategy

## Testing principles
Stage 2 keeps the stage-1 testing philosophy:
- parity-first for mapping and API shape
- runtime-gated by the current public TypeScript processor/runtime
- explicit deviations when Java and runtime diverge

## Mandatory test layers
### 1. Parity tests
Use inline YAML fixtures and the stage-1 parity helper.
The helper must continue to:
- build the doc from DSL
- parse expected YAML into a `BlueNode`
- preprocess both sides
- compare `official` JSON structures
- compare BlueIds where practical

### 2. Guardrail tests
Add focused tests for:
- blank event names in `namedEvent(...)`
- blank bootstrap expressions in `bootstrapDocumentExpr(...)`
- invalid patch paths in `ChangesetBuilder`
- null factory / null return in `ext(factory)`

### 3. Runtime integration tests
Add processor-backed tests proving behavior for:
- `onInit(...)`
- `onEvent(...)`
- `onNamedEvent(...)`
- `onDocChange(...)`
- `updateDocumentFromExpression(...)`
- emitted bootstrap request event shape

### 4. Regression tests for deviations
Every justified stage-2 deviation must have:
- a documented note in `stage-2-deviations.md`
- a focused regression test

## Java test traceability
Each TypeScript test file should start with a short comment listing the Java test file(s) it ports or adapts.

## Stage-2 Java tests to port/adapt
### `DocBuilderGeneralDslParityTest.java`
Port these cases:
- `onEventMatchesYamlDefinition`
- `onNamedEventMatchesYamlDefinition`
- `onDocChangeMatchesYamlDefinition`
- `onInitMatchesYamlDefinition`

### `DocBuilderChannelsDslParityTest.java`
Port:
- `onChannelEventMatchesYamlDefinition`

### `DocBuilderStepsDslParityTest.java`
Port/adapt:
- stage-2-relevant subset of `stepPrimitivesAndEmitHelpersBuildExpectedContracts`
- `bootstrapDocumentBuildersMapDocumentBindingsAndOptions`
- `eventEmitHelpersRequireExplicitStepNames`
- `extRejectsNullFactoriesAndNullExtensions`
- `extSupportsCustomStepExtensions`

Do not port stage-3+ cases from the same file yet:
- trigger payment
- backward payment
- capture namespace
- payment ext payload builders

## Recommended test file layout
- `libs/sdk-dsl/src/__tests__/DocBuilder.general.parity.test.ts` (extend)
- `libs/sdk-dsl/src/__tests__/DocBuilder.channels.parity.test.ts` (extend)
- `libs/sdk-dsl/src/__tests__/DocBuilder.steps.parity.test.ts` (new or extend)
- `libs/sdk-dsl/src/__tests__/DocBuilder.handlers.integration.test.ts`
- `libs/sdk-dsl/src/__tests__/ChangesetBuilder.guardrails.test.ts`

## Required runtime scenarios
### `onInit(...)`
Build a document with an init workflow that updates a field. Initialize through the processor and assert the field changed.

### `onEvent(...)`
Build a document where an init workflow emits a typed event and a triggered-event workflow reacts to it. Assert the final state.

### `onNamedEvent(...)`
Build a document where an init workflow emits a named event and a triggered-event workflow reacts to it. Assert the final state.

### `onDocChange(...)`
Build a document where one workflow updates a watched path and the generated doc-update workflow reacts to that change. Assert both state transitions.

### `updateDocumentFromExpression(...)`
Build a document where a JS step returns a dynamic changeset and the next step applies it via expression reference. Assert the applied state.

### `bootstrapDocument(...)`
Build a document that emits a bootstrap request. Capture emitted events through the processor harness and assert the request shape.

## `onChannelEvent(...)` runtime note
Add a processor-backed runtime test if the public processor API supports direct external channel-event delivery cleanly.
If not, keep parity coverage and document the limitation in stage-2 deviations.

## Documentation obligations
As tests are implemented, keep these files updated:
- `docs/ts-dsl-sdk/stage-2-mapping-matrix.md`
- `docs/ts-dsl-sdk/stage-2-deviations.md`
- `docs/ts-dsl-sdk/stage-2-coverage-matrix.md`

## Verification commands
```bash
npx tsc -p libs/sdk-dsl/tsconfig.lib.json --noEmit
npx tsc -p libs/sdk-dsl/tsconfig.spec.json --noEmit
npx eslint libs/sdk-dsl
npx vitest run --config libs/sdk-dsl/vite.config.ts
npx vite build --config libs/sdk-dsl/vite.config.ts
```
