# BLUE TS DSL SDK — Stage 1 Deviations from Java

Use this file to record any justified behavioral or API differences between the Java reference and the TypeScript stage-1 implementation.

## Rule
A deviation is allowed only when one of these is true:
1. Java uses a construct that does not translate directly to TypeScript stage-1 inputs, for example `Class<?>`.
2. Java uses reflection/bean serialization that stage 1 intentionally does not support.
3. A proven conflict exists between Java parity and the current public TypeScript runtime.

If a deviation is recorded, it must also be:
- reflected in `stage-1-mapping-matrix.md` where relevant,
- covered in `stage-1-coverage-matrix.md`,
- and locked by at least one focused regression test.

## Entry template
### <Title>
- **Status**: proposed / accepted / resolved / rejected
- **Java source reference**:
  - `references/java-sdk/...`
- **Minimal DSL repro**:
  ```ts
  // minimal reproducible snippet
  ```
- **Java/reference expectation**:
  - what Java or the Java docs expect
- **Runtime/actual behavior**:
  - what the current public TS runtime accepts or requires
- **Implementation decision**:
  - what the TS DSL does
- **Rationale**:
  - why this decision was taken
- **Confirming tests**:
  - test file(s) and test name(s)

## Current deviations

### Unregistered string aliases are preserved inline but not treated as runtime-safe parity inputs
- **Status**: accepted
- **Java source reference**:
  - `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java`
  - `references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java`
- **Minimal DSL repro**:
  ```ts
  const document = DocBuilder.doc()
    .type('Custom/Unknown Type')
    .buildDocument();
  ```
- **Java/reference expectation**:
  - arbitrary string aliases are accepted as authoring inputs and can be asserted structurally in parity tests
- **Runtime/actual behavior**:
  - the current public TypeScript `Blue.preprocess(...)` rejects unknown aliases with:
    - `Unknown type "..." found in type field. No BlueId mapping exists for this type.`
- **Implementation decision**:
  - sdk-dsl resolves repository-known aliases to repository BlueIds during authoring
  - sdk-dsl preserves unknown aliases inline in the built `BlueNode`
  - stage-1 parity and processor-backed tests use runtime-known aliases only
- **Rationale**:
  - this keeps stage-1 output runtime-correct for the in-scope documented alias forms while still allowing callers to author custom inline aliases intentionally
  - it makes the runtime limitation explicit instead of silently claiming that unknown aliases are executable
- **Confirming tests**:
  - `libs/sdk-dsl/src/lib/__tests__/type-input.test.ts` — `preserves unknown string aliases as inline values`
