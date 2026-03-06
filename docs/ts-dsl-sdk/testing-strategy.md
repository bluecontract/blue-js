# BLUE TS DSL SDK — Testing Strategy

## Purpose
The test suite is the definition of done for stage 1.
Implementation is accepted only when Java-derived parity and current TypeScript runtime execution both hold for the covered slice.

## Validation model
- Layer 1: Java-derived parity for public builder behavior and BLUE document mapping.
- Layer 2: focused unit and guardrail tests for helper behavior and edge cases.
- Layer 3: processor-backed integration for executable runtime correctness.

Java remains the public API reference.
The current TypeScript runtime remains the execution gate.

## Implemented stage-1 test files
- `libs/sdk-dsl/src/__tests__/DocBuilder.general.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.channels.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.sections.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.operations.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.core.test.ts`
- `libs/sdk-dsl/src/__tests__/StepsBuilder.core.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.counter.integration.test.ts`
- `libs/sdk-dsl/src/__tests__/dsl-parity.ts`
- `libs/sdk-dsl/src/__tests__/processor-harness.ts`

Every test file starts with Java reference comments for traceability.

## Parity helper
`dsl-parity.ts` mirrors Java `DslParityAssertions` with TypeScript runtime constraints:
1. build the document from the TS DSL
2. parse expected YAML with `Blue`
3. preprocess both nodes
4. compare structural JSON from `nodeToJson(..., 'official')`
5. compare `calculateBlueIdSync(...)`
6. print expected and actual YAML plus JSON on mismatch

### Harness note
The parity helper uses `createBlue()` from `processor-harness.ts`.
That helper includes:
- the public `@blue-repository/types` repository
- a small test-only repository entry for `Custom/Type`

The extra alias keeps the parity helper faithful to the Java string-type fixture while leaving runtime behavior documented in `stage-1-deviations.md`.

## Unit and guardrail coverage
`DocBuilder.core.test.ts` covers:
- `DocBuilder.expr(...)`
- type-input resolution, including unresolved custom aliases
- pointer write/remove helpers
- public `.replace(...)` and `.remove(...)`

`StepsBuilder.core.test.ts` covers:
- `jsRaw`
- `replaceValue`
- `replaceExpression`
- `triggerEvent`
- `emit`
- `emitType`
- `raw`

Guardrails covered across parity and unit tests:
- `edit(existing)` preserves identity
- `from(existing)` clones
- `buildDocument()` rejects unclosed sections
- missing Zod `typeBlueId` annotations throw

## Processor-backed integration harness
`processor-harness.ts` uses only public package APIs and provides:
- `createBlue()`
- `createDocumentProcessor()`
- marker registration for:
  - `Conversation/Document Section`
  - `Conversation/Contracts Change Policy`
- `initializeDocument(...)`
- `processOperationRequest(...)`
- `makeOperationRequestEvent(...)`

No cross-library deep `src/...` imports are used from consumer code.
Test-time Vite aliases point package imports at local source to avoid stale built artifacts.

## Java sources ported or reproduced
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DslParityAssertions.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderSectionsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/DocBuilderCounterIntegrationTest.java`

## Deviations policy
Accepted stage-1 deviations must be recorded when they come from:
- Java `Class<?>` APIs translated to TS `typeInput`
- Java bean/reflection serialization replaced by `BlueNode` or plain-object inputs
- proven runtime conflicts in the current TS BLUE runtime

Each deviation entry must include:
- title
- status
- minimal DSL repro
- Java/reference expectation
- runtime/actual behavior
- implementation decision
- rationale
- confirming tests

## Verification commands
Required:
- `npx tsc -p libs/sdk-dsl/tsconfig.lib.json --noEmit`
- `npx tsc -p libs/sdk-dsl/tsconfig.spec.json --noEmit`
- `npx eslint libs/sdk-dsl`
- `npx vitest run --config libs/sdk-dsl/vite.config.ts`
- `npx vite build --config libs/sdk-dsl/vite.config.ts`

Recommended extra regression check:
- `npx vitest run --config libs/document-processor/vite.config.ts`
