# BLUE TS DSL SDK — Stage 1 Deviations from Java

## Rule
A deviation is allowed only when:
1. Java uses a construct that does not translate directly to TypeScript stage-1 inputs.
2. Java uses reflection or bean serialization that stage 1 intentionally does not support.
3. A proven conflict exists between Java parity and the current public TypeScript runtime.

Every accepted deviation is reflected in the mapping and coverage matrices and covered by tests.

## Current deviations

### Unknown string type aliases require repository support at runtime
- **Status**: accepted
- **Java source reference**:
  - `references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java`
  - `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java`
- **Minimal DSL repro**:
  ```ts
  const doc = DocBuilder.doc()
    .name('Identity parity')
    .type('Custom/Type')
    .buildDocument();
  ```
- **Java/reference expectation**:
  - The Java DSL accepts a free-form string alias and the parity fixture uses `type: Custom/Type`.
- **Runtime/actual behavior**:
  - The current public TypeScript BLUE preprocessor rejects unknown inline aliases unless the active repository set includes a mapping for that alias.
- **Implementation decision**:
  - `sdk-dsl` preserves unknown string aliases as inline type nodes instead of rejecting them early.
  - The parity harness registers a tiny test-only repository entry for `Custom/Type` so the Java-derived parity fixture can still preprocess structurally.
- **Rationale**:
  - Rejecting the alias in the DSL would drift from Java authoring behavior.
  - Pretending the runtime can preprocess arbitrary aliases without repository support would be incorrect.
  - Preserving the alias keeps authoring parity while leaving execution-time resolution to the caller’s repository configuration.
- **Confirming tests**:
  - `libs/sdk-dsl/src/__tests__/DocBuilder.general.parity.test.ts`
  - `libs/sdk-dsl/src/__tests__/DocBuilder.core.test.ts`

### Java reflection-style object serialization is replaced by plain-object and `BlueNode` inputs
- **Status**: accepted
- **Java source reference**:
  - `references/java-sdk/src/main/java/blue/language/sdk/DocBuilder.java`
  - `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderOperationsDslParityTest.java`
  - `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderChannelsDslParityTest.java`
- **Minimal DSL repro**:
  ```ts
  const doc = DocBuilder.doc()
    .channel('ownerChannel', {
      type: 'MyOS/MyOS Timeline Channel',
      timelineId: 'timeline-1',
    })
    .operation('emit')
    .channel('ownerChannel')
    .request({
      type: 'List',
      items: [{ type: 'Integer' }, { type: 'Conversation/Event' }],
    })
    .done()
    .buildDocument();
  ```
- **Java/reference expectation**:
  - Java accepts arbitrary objects and beans via `BLUE.objectToNode(...)`.
- **Runtime/actual behavior**:
  - TypeScript has no Java reflection equivalent and the public language API does not expose a bean serializer matching Java behavior.
- **Implementation decision**:
  - Stage 1 accepts primitives, arrays, plain objects, and `BlueNode`.
  - General plain-object values use public BLUE JSON-like conversion.
  - Operation request schemas use a dedicated local converter so Java request-schema shapes such as `{ type: 'List', items: [...] }` map correctly.
- **Rationale**:
  - This matches the stage-1 scope and public API constraints while keeping the covered Java mappings intact.
  - It avoids depending on non-public internals or inventing a partial reflection layer.
- **Confirming tests**:
  - `libs/sdk-dsl/src/__tests__/DocBuilder.channels.parity.test.ts`
  - `libs/sdk-dsl/src/__tests__/DocBuilder.operations.parity.test.ts`
  - `libs/sdk-dsl/src/__tests__/DocBuilder.sections.parity.test.ts`
  - `libs/sdk-dsl/src/__tests__/StepsBuilder.core.test.ts`
