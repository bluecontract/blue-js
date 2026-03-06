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

_No deviations recorded yet._
