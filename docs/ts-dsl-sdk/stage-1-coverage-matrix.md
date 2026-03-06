# BLUE TS DSL SDK — Stage 1 Coverage Matrix

## Status legend
- `done`
- `deviation`
- `out-of-scope`

| Feature | Java reference | Mapping / parity test | Unit / guardrail test | Processor integration | Status | Deviation link |
|---|---|---|---|---|---|---|
| `DocBuilder.doc()` | `DocBuilderGeneralDslParityTest.java` | `DocBuilder.general.parity.test.ts` |  | `DocBuilder.counter.integration.test.ts` | done |  |
| `DocBuilder.edit(existing)` | `DocBuilderGeneralDslParityTest.java` | `DocBuilder.general.parity.test.ts` |  |  | done |  |
| `DocBuilder.from(existing)` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderChannelsDslParityTest.java` | `DocBuilder.general.parity.test.ts`, `DocBuilder.channels.parity.test.ts` |  |  | done |  |
| `DocBuilder.expr(...)` | `DocBuilder.java`, `StepsBuilder.java` |  | `DocBuilder.core.test.ts` | `DocBuilder.counter.integration.test.ts` | done |  |
| `.name(...)` | `DocBuilderGeneralDslParityTest.java` | `DocBuilder.general.parity.test.ts` |  | `DocBuilder.counter.integration.test.ts` | done |  |
| `.description(...)` | `DocBuilderGeneralDslParityTest.java` | `DocBuilder.general.parity.test.ts` |  |  | done |  |
| `.type(...)` | `DocBuilderGeneralDslParityTest.java` | `DocBuilder.general.parity.test.ts` | `DocBuilder.core.test.ts` |  | deviation | [Unknown string type aliases require repository support at runtime](stage-1-deviations.md#unknown-string-type-aliases-require-repository-support-at-runtime) |
| `.field(path, value)` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderSectionsDslParityTest.java` | `DocBuilder.sections.parity.test.ts`, `DocBuilder.general.parity.test.ts` | `DocBuilder.core.test.ts` | `DocBuilder.counter.integration.test.ts` | done | [Java reflection-style object serialization is replaced by plain-object and `BlueNode` inputs](stage-1-deviations.md#java-reflection-style-object-serialization-is-replaced-by-plain-object-and-bluenode-inputs) |
| `.field(path)` builder | `DocBuilderSectionsDslParityTest.java` | `DocBuilder.sections.parity.test.ts` |  |  | done |  |
| `.replace(path, value)` | `DocBuilder.java` |  | `DocBuilder.core.test.ts` |  | done |  |
| `.remove(path)` | `DocBuilder.java` |  | `DocBuilder.core.test.ts` |  | done |  |
| `.channel(name)` | `DocBuilderChannelsDslParityTest.java` | `DocBuilder.channels.parity.test.ts` |  | `DocBuilder.counter.integration.test.ts` | done |  |
| `.channel(name, contractLike)` | `DocBuilderChannelsDslParityTest.java` | `DocBuilder.channels.parity.test.ts` |  | `DocBuilder.counter.integration.test.ts` | deviation | [Java reflection-style object serialization is replaced by plain-object and `BlueNode` inputs](stage-1-deviations.md#java-reflection-style-object-serialization-is-replaced-by-plain-object-and-bluenode-inputs) |
| `.channels(...names)` | `DocBuilderChannelsDslParityTest.java` | `DocBuilder.channels.parity.test.ts` |  |  | done |  |
| `.compositeChannel(...)` | `DocBuilderChannelsDslParityTest.java` | `DocBuilder.channels.parity.test.ts` |  |  | done |  |
| `.section(...)` | `DocBuilderSectionsDslParityTest.java` | `DocBuilder.sections.parity.test.ts` |  |  | done |  |
| `.endSection()` | `DocBuilderSectionsDslParityTest.java` | `DocBuilder.sections.parity.test.ts` |  |  | done |  |
| inline `.operation(...)` overloads | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` | `DocBuilder.general.parity.test.ts`, `DocBuilder.operations.parity.test.ts` |  | `DocBuilder.counter.integration.test.ts` | done |  |
| builder `.operation(key)` | `DocBuilderOperationsDslParityTest.java` | `DocBuilder.operations.parity.test.ts` |  | `DocBuilder.counter.integration.test.ts` | done |  |
| operation `.requestType(...)` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` | `DocBuilder.general.parity.test.ts`, `DocBuilder.operations.parity.test.ts` | `DocBuilder.core.test.ts` | `DocBuilder.counter.integration.test.ts` | done |  |
| operation `.request(...)` | `DocBuilderOperationsDslParityTest.java` | `DocBuilder.operations.parity.test.ts` |  |  | deviation | [Java reflection-style object serialization is replaced by plain-object and `BlueNode` inputs](stage-1-deviations.md#java-reflection-style-object-serialization-is-replaced-by-plain-object-and-bluenode-inputs) |
| operation `.requestDescription(...)` | `DocBuilderGeneralDslParityTest.java` | `DocBuilder.general.parity.test.ts` |  | `DocBuilder.counter.integration.test.ts` | done |  |
| operation `.noRequest()` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` | `DocBuilder.general.parity.test.ts`, `DocBuilder.operations.parity.test.ts` |  |  | done |  |
| operation `.steps(...)` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` | `DocBuilder.general.parity.test.ts`, `DocBuilder.operations.parity.test.ts` |  | `DocBuilder.counter.integration.test.ts` | done |  |
| `StepsBuilder.jsRaw(...)` | `StepsBuilder.java` |  | `StepsBuilder.core.test.ts` | `DocBuilder.operations.parity.test.ts` | done |  |
| `StepsBuilder.replaceValue(...)` | `StepsBuilder.java` |  | `StepsBuilder.core.test.ts` |  | done |  |
| `StepsBuilder.replaceExpression(...)` | `StepsBuilder.java` | `DocBuilder.general.parity.test.ts`, `DocBuilder.sections.parity.test.ts` | `StepsBuilder.core.test.ts` | `DocBuilder.counter.integration.test.ts` | done |  |
| `StepsBuilder.triggerEvent(...)` | `StepsBuilder.java` |  | `StepsBuilder.core.test.ts` |  | done |  |
| `StepsBuilder.emit(...)` | `StepsBuilder.java` | `DocBuilder.operations.parity.test.ts` | `StepsBuilder.core.test.ts` |  | deviation | [Java reflection-style object serialization is replaced by plain-object and `BlueNode` inputs](stage-1-deviations.md#java-reflection-style-object-serialization-is-replaced-by-plain-object-and-bluenode-inputs) |
| `StepsBuilder.emitType(...)` | `StepsBuilder.java` | `DocBuilder.operations.parity.test.ts` | `StepsBuilder.core.test.ts` |  | done |  |
| `StepsBuilder.raw(...)` | `StepsBuilder.java` |  | `StepsBuilder.core.test.ts` |  | done |  |
| parity helper (`DslParityAssertions` equivalent) | `DslParityAssertions.java` | `dsl-parity.ts` |  | n/a | done | [Unknown string type aliases require repository support at runtime](stage-1-deviations.md#unknown-string-type-aliases-require-repository-support-at-runtime) |
| counter end-to-end integration | `DocBuilderCounterIntegrationTest.java` | `DocBuilder.counter.integration.test.ts` | `processor-harness.ts` | yes | done |  |

## Out-of-scope for stage 1
| Feature | Status | Notes |
|---|---|---|
| `onInit`, `onEvent`, `onNamedEvent`, `onDocChange`, `onChannelEvent` | out-of-scope | stage 2 |
| `canEmit` | out-of-scope | stage 2+ |
| MyOS / interactions | out-of-scope | later stage |
| access / linked access / agency | out-of-scope | later stage |
| AI | out-of-scope | later stage |
| PayNote | out-of-scope | later stage |
| patch / structure / generator pipeline | out-of-scope | later stage |
