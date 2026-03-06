# BLUE TS DSL SDK — Testing Strategy

## Purpose
The test suite is the operational definition of done for the DSL SDK.
Because implementation is being driven by an agent, tests must be explicit, close to the Java reference, and strong enough to prevent semantic drift.

## Test philosophy
Use a dual-layer validation model:
- **Layer 1 — Java-derived parity** for builder behavior and mapping intent in the stage-1 scope.
- **Layer 2 — TypeScript runtime correctness** for actual executability in the current public runtime.

Java is the reference target.
The current public TypeScript runtime is the final gate.
When they conflict for an in-scope feature, keep runtime-correct behavior, document the deviation, and cover it with a regression test.

## Test layers

### 1. Parity tests
Use inline YAML fixtures as the expected readable source and compare against documents built from the TypeScript DSL.
The primary oracle is structural equality after preprocessing, not raw YAML text.

### 2. Direct unit tests
Use focused unit tests for small helpers where this increases confidence and debuggability:
- expression wrapping
- type input resolution
- pointer write/remove helper
- in-scope `StepsBuilder` step node construction

### 3. Guardrail tests
Explicitly test error and mutability semantics such as:
- `edit(existing)` returns the same instance
- `from(existing)` returns a clone
- unclosed section throws on `buildDocument()`
- invalid/unsupported type inputs throw clear errors

### 4. Runtime integration tests
Use `document-processor` to prove that representative documents are not just structurally correct but operationally valid.
Stage 1 requires at least the counter document integration flow.

## Java traceability
Every stage-1 TypeScript test file should start with a short comment showing which Java test file(s) it ports or adapts.
This keeps parity work auditable.

## Required stage-1 TypeScript test files
The implemented stage-1 test suite is:
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.general.parity.test.ts`
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.channels.parity.test.ts`
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.sections.parity.test.ts`
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.operations.parity.test.ts`
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.expr.test.ts`
- `libs/sdk-dsl/src/lib/__tests__/type-input.test.ts`
- `libs/sdk-dsl/src/lib/__tests__/pointer.test.ts`
- `libs/sdk-dsl/src/lib/__tests__/steps-builder.core.test.ts`
- `libs/sdk-dsl/src/lib/__tests__/doc-builder.counter.integration.test.ts`
- `libs/sdk-dsl/src/lib/test-support/dsl-parity.ts`
- `libs/sdk-dsl/src/lib/test-support/processor-harness.ts`
- `libs/sdk-dsl/src/lib/test-support/create-blue.ts`

## Required Java sources to port or faithfully reproduce
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DslParityAssertions.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderSectionsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/DocBuilderCounterIntegrationTest.java`

## Parity helper requirements
The parity helper should mirror the intent of Java `DslParityAssertions`:
1. build the node from the TS DSL
2. parse the expected YAML into a `BlueNode`
3. preprocess both nodes
4. compare canonical structural JSON
5. compare `calculateBlueIdSync(...)` where practical
6. print useful YAML or JSON on failures

The implemented parity helper uses a repository-backed `Blue` instance and:
- preprocesses both nodes
- compares `nodeToJson(..., 'simple')`
- compares calculated BlueIds after structural comparison
- dumps both YAML and JSON payloads when mismatches occur

## Processor test harness requirements
Use only public package APIs.
The test harness should:
1. create a `Blue` runtime aligned with current workspace patterns
2. create a `DocumentProcessor` using public package imports
3. register markers for:
   - `Conversation/Document Section`
   - `Conversation/Contracts Change Policy`
4. expose helpers for:
   - document initialization
   - representative operation processing

Do not use deep relative imports into `src/...` across libraries.

The implemented processor harness:
- uses `@blue-labs/document-processor` public exports only
- creates repository-backed `Blue` with `createDefaultMergingProcessor()`
- registers pass-through marker processors for:
  - `Conversation/Document Section`
  - `Conversation/Contracts Change Policy`
- exposes an operation-request timeline-entry helper used by the counter integration test

## Coverage matrix requirement
Keep `docs/ts-dsl-sdk/stage-1-coverage-matrix.md` updated.
For every in-scope feature, list:
- feature name
- Java reference file(s)
- mapping/parity test file
- unit/guardrail test file if relevant
- processor integration coverage
- status
- deviation link if any

## Deviations policy
A Java test may be adapted when:
- Java uses `Class<?>` and TS uses a stage-1 `typeInput`
- Java uses bean serialization and TS uses Blue-shaped objects or `BlueNode`
- a runtime conflict is proven in the current public TS runtime

Every such deviation must be documented in `docs/ts-dsl-sdk/stage-1-deviations.md` with:
- title
- status
- Java source reference
- minimal DSL repro
- Java/reference expectation
- runtime/actual behavior
- implementation decision
- reason
- confirming TS test(s)

## What is not acceptable
- snapshot-only testing as the primary oracle
- passing tests that validate only YAML substrings
- silently skipping Java reference coverage without documenting it
- claiming completion without running typecheck, lint, tests, and build
- changing the processor to make DSL tests pass

## Required verification commands
- `npx tsc -p libs/sdk-dsl/tsconfig.lib.json --noEmit`
- `npx tsc -p libs/sdk-dsl/tsconfig.spec.json --noEmit`
- `npx eslint libs/sdk-dsl`
- `npx vitest run --config libs/sdk-dsl/vite.config.ts`
- `npx vite build --config libs/sdk-dsl/vite.config.ts`

Recommended extra regression check:
- `npx vitest run --config libs/document-processor/vite.config.ts`
