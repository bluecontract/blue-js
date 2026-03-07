# BLUE TS DSL SDK — Stage 2 Testing Strategy

## Testing principles
- parity-first for Java-derived mappings and builder behavior
- runtime-gated by the current public TypeScript processor
- explicit deviations when Java and runtime differ
- no stage-1 regressions
- `libs/sdk-dsl` pins local source-path resolution for `@blue-labs/language` and `@blue-labs/document-processor` so `tsc`, Vitest, and Vite build against the same workspace sources during verification
- `tsc` verification uses source-expanded `tsconfig.lib.json` / `tsconfig.spec.json`, while declaration generation uses `tsconfig.dts.json` so `vite build` stays scoped to `sdk-dsl` outputs

## Test layers

### 1. Parity tests
Files:
- `libs/sdk-dsl/src/__tests__/DocBuilder.general.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.channels.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.steps.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.sections.parity.test.ts`

Coverage:
- handler contract generation
- handler section tracking for auto-created/reused lifecycle and triggered-event channels
- step contract generation
- bootstrap payload mapping
- `ext(factory)` custom extension shape

Oracle:
- preprocess both expected and actual trees
- compare `official` JSON structures
- compare BlueIds

Named-event note:
- the parity helper uses a parity-only supplemental repository alias for `Common/Named Event` so canonical comparison can still run
- runtime tests do not use that supplemental alias

### 2. Guardrail tests
Files:
- `libs/sdk-dsl/src/__tests__/ChangesetBuilder.guardrails.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.steps.parity.test.ts`

Coverage:
- blank event names
- blank bootstrap expressions
- blank patch paths
- reserved processor-managed patch paths
- null extension factories / null extension returns
- explicit step-name requirements for event emit helpers

### 3. Runtime integration tests
Files:
- `libs/sdk-dsl/src/__tests__/DocBuilder.handlers.integration.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.counter.integration.test.ts`

Coverage:
- `onInit(...)`
- `onEvent(...)`
- `onNamedEvent(...)`
- `onDocChange(...)`
- `updateDocumentFromExpression(...)`
- bootstrap request emission
- bootstrap request emission from `bootstrapDocumentExpr(...)`
- stage-1 counter vertical slice

### 4. Deviation regression tests
Every accepted deviation is paired with a focused test:
- named-event runtime-compatible matcher/emission coverage
- `onChannelEvent(...)` public-runtime limitation coverage

## Java traceability
Each TypeScript test file starts with a short comment listing the Java source file(s) it ports or adapts.

Stage-2 Java cases covered:
- `DocBuilderGeneralDslParityTest`
  - `onEventMatchesYamlDefinition`
  - `onNamedEventMatchesYamlDefinition`
  - `onDocChangeMatchesYamlDefinition`
  - `onInitMatchesYamlDefinition`
- `DocBuilderChannelsDslParityTest`
  - `onChannelEventMatchesYamlDefinition`
- `DocBuilderStepsDslParityTest`
  - stage-2-relevant subset of `stepPrimitivesAndEmitHelpersBuildExpectedContracts`
  - `bootstrapDocumentBuildersMapDocumentBindingsAndOptions`
  - `eventEmitHelpersRequireExplicitStepNames`
  - `extRejectsNullFactoriesAndNullExtensions`
  - `extSupportsCustomStepExtensions`

## Public-runtime limitation handling
- `onChannelEvent(...)` keeps parity coverage
- the current public processor does not expose a clean positive runtime path for timeline-message matcher dispatch
- instead of fabricating a green-path harness, the suite records the limitation as a documented deviation plus a regression test

## Required verification
```bash
npm install
npx tsc -p libs/sdk-dsl/tsconfig.lib.json --noEmit
npx tsc -p libs/sdk-dsl/tsconfig.spec.json --noEmit
npx eslint libs/sdk-dsl
npx vitest run --config libs/sdk-dsl/vite.config.ts
npx vite build --config libs/sdk-dsl/vite.config.ts
```
