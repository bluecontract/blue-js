# BLUE TS DSL SDK — Stage 1 Coverage Matrix

Update this matrix during implementation.
The goal is to make missing coverage immediately visible.

## Status legend
- `todo`
- `in-progress`
- `done`
- `deviation`
- `out-of-scope`

| Feature | Java reference | Mapping / parity test | Unit / guardrail test | Processor integration | Status | Deviation link |
|---|---|---|---|---|---|---|
| `DocBuilder.doc()` | `DocBuilderGeneralDslParityTest.java` | `doc-builder.general.parity.test.ts` | n/a | n/a | done |  |
| `DocBuilder.edit(existing)` | `DocBuilderGeneralDslParityTest.java` | `doc-builder.general.parity.test.ts` | `doc-builder.general.parity.test.ts` | n/a | done |  |
| `DocBuilder.from(existing)` | `DocBuilderGeneralDslParityTest.java` | `doc-builder.general.parity.test.ts` | `doc-builder.general.parity.test.ts` | n/a | done |  |
| `DocBuilder.expr(...)` | `DocBuilder.java`, `StepsBuilder.java` usage | n/a | `doc-builder.expr.test.ts` | n/a | done |  |
| `.name(...)` | `DocBuilderGeneralDslParityTest.java` | `doc-builder.general.parity.test.ts` | n/a | `doc-builder.counter.integration.test.ts` | done |  |
| `.description(...)` | `DocBuilderGeneralDslParityTest.java` | `doc-builder.general.parity.test.ts` | n/a | `doc-builder.counter.integration.test.ts` | done |  |
| `.type(...)` | `DocBuilderGeneralDslParityTest.java` | `doc-builder.general.parity.test.ts` | `type-input.test.ts` | n/a | deviation | `#truly-unregistered-string-aliases-are-preserved-inline-but-are-not-runtime-safe` |
| `.field(path, value)` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderSectionsDslParityTest.java` | `doc-builder.sections.parity.test.ts` | `pointer.test.ts` | `doc-builder.counter.integration.test.ts` | done |  |
| `.field(path)` builder | `DocBuilderSectionsDslParityTest.java` | `doc-builder.sections.parity.test.ts` | `doc-builder.sections.parity.test.ts` | n/a | done |  |
| `.replace(path, value)` | `DocBuilder.java` / direct behavior | n/a | `pointer.test.ts` | n/a | done |  |
| `.remove(path)` | `DocBuilder.java` / direct behavior | n/a | `pointer.test.ts` | n/a | done |  |
| `.channel(name)` | `DocBuilderChannelsDslParityTest.java` | `doc-builder.channels.parity.test.ts` | n/a | n/a | done |  |
| `.channel(name, contractLike)` | `DocBuilderChannelsDslParityTest.java` | `doc-builder.channels.parity.test.ts` | n/a | `doc-builder.counter.integration.test.ts` | done |  |
| `.channels(...names)` | `DocBuilderChannelsDslParityTest.java` | `doc-builder.channels.parity.test.ts` | n/a | n/a | done |  |
| `.compositeChannel(...)` | `DocBuilderChannelsDslParityTest.java` | `doc-builder.channels.parity.test.ts` | n/a | n/a | done |  |
| `.section(...)` | `DocBuilderSectionsDslParityTest.java` | `doc-builder.sections.parity.test.ts` | `doc-builder.sections.parity.test.ts` | n/a | done |  |
| `.endSection()` | `DocBuilderSectionsDslParityTest.java` | `doc-builder.sections.parity.test.ts` | `doc-builder.sections.parity.test.ts` | n/a | done |  |
| inline `.operation(...)` overloads | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts` | n/a | `doc-builder.counter.integration.test.ts` | done |  |
| builder `.operation(key)` | `DocBuilderOperationsDslParityTest.java` | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts` | n/a | `doc-builder.counter.integration.test.ts` | done |  |
| operation `.requestType(...)` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts` | `type-input.test.ts` | `doc-builder.counter.integration.test.ts` | done |  |
| operation `.request(...)` | `DocBuilderOperationsDslParityTest.java` | `doc-builder.operations.parity.test.ts` | n/a | n/a | done |  |
| operation `.requestDescription(...)` | `DocBuilderGeneralDslParityTest.java` | `doc-builder.general.parity.test.ts` | n/a | `doc-builder.counter.integration.test.ts` | done |  |
| operation `.noRequest()` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts` | n/a | n/a | done |  |
| operation `.steps(...)` | `DocBuilderOperationsDslParityTest.java` | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts` | n/a | `doc-builder.counter.integration.test.ts` | done |  |
| `StepsBuilder.jsRaw(...)` | `StepsBuilder.java` | n/a | `steps-builder.core.test.ts` | n/a | done |  |
| `StepsBuilder.replaceValue(...)` | `StepsBuilder.java` | `doc-builder.general.parity.test.ts` | `steps-builder.core.test.ts` | n/a | done |  |
| `StepsBuilder.replaceExpression(...)` | `StepsBuilder.java` | `doc-builder.general.parity.test.ts`, `doc-builder.sections.parity.test.ts` | `steps-builder.core.test.ts` | `doc-builder.counter.integration.test.ts` | done |  |
| `StepsBuilder.triggerEvent(...)` | `StepsBuilder.java` | n/a | `steps-builder.core.test.ts` | n/a | done |  |
| `StepsBuilder.emit(...)` | `StepsBuilder.java` | n/a | `steps-builder.core.test.ts` | n/a | done |  |
| `StepsBuilder.emitType(...)` | `StepsBuilder.java` | `doc-builder.operations.parity.test.ts` | `steps-builder.core.test.ts` | n/a | done |  |
| `StepsBuilder.raw(...)` | `StepsBuilder.java` | n/a | `steps-builder.core.test.ts` | n/a | done |  |
| parity helper (`DslParityAssertions` equivalent) | `DslParityAssertions.java` | `src/__tests__/support/dsl-parity.ts` | n/a | n/a | done |  |
| counter end-to-end integration | `DocBuilderCounterIntegrationTest.java` | `doc-builder.counter.integration.test.ts` | n/a | `doc-builder.counter.integration.test.ts` | done |  |

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
