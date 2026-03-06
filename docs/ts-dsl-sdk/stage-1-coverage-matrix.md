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
| `DocBuilder.doc()` | `DocBuilderGeneralDslParityTest.java` |  |  |  | todo |  |
| `DocBuilder.edit(existing)` | `DocBuilderGeneralDslParityTest.java` |  |  |  | todo |  |
| `DocBuilder.from(existing)` | `DocBuilderGeneralDslParityTest.java` |  |  |  | todo |  |
| `DocBuilder.expr(...)` | `DocBuilder.java`, `StepsBuilder.java` usage |  |  | n/a | todo |  |
| `.name(...)` | `DocBuilderGeneralDslParityTest.java` |  |  |  | todo |  |
| `.description(...)` | `DocBuilderGeneralDslParityTest.java` |  |  |  | todo |  |
| `.type(...)` | `DocBuilderGeneralDslParityTest.java` |  |  |  | todo |  |
| `.field(path, value)` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderSectionsDslParityTest.java` |  |  |  | todo |  |
| `.field(path)` builder | `DocBuilderSectionsDslParityTest.java` |  |  |  | todo |  |
| `.replace(path, value)` | `DocBuilder.java` / direct behavior |  |  |  | todo |  |
| `.remove(path)` | `DocBuilder.java` / direct behavior |  |  |  | todo |  |
| `.channel(name)` | `DocBuilderChannelsDslParityTest.java` |  |  |  | todo |  |
| `.channel(name, contractLike)` | `DocBuilderChannelsDslParityTest.java` |  |  |  | todo |  |
| `.channels(...names)` | `DocBuilderChannelsDslParityTest.java` |  |  |  | todo |  |
| `.compositeChannel(...)` | `DocBuilderChannelsDslParityTest.java` |  |  |  | todo |  |
| `.section(...)` | `DocBuilderSectionsDslParityTest.java` |  |  |  | todo |  |
| `.endSection()` | `DocBuilderSectionsDslParityTest.java` |  |  |  | todo |  |
| inline `.operation(...)` overloads | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` |  |  |  | todo |  |
| builder `.operation(key)` | `DocBuilderOperationsDslParityTest.java` |  |  |  | todo |  |
| operation `.requestType(...)` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` |  |  |  | todo |  |
| operation `.request(...)` | `DocBuilderOperationsDslParityTest.java` |  |  |  | todo |  |
| operation `.requestDescription(...)` | `DocBuilderGeneralDslParityTest.java` |  |  |  | todo |  |
| operation `.noRequest()` | `DocBuilderGeneralDslParityTest.java`, `DocBuilderOperationsDslParityTest.java` |  |  |  | todo |  |
| operation `.steps(...)` | `DocBuilderOperationsDslParityTest.java` |  |  |  | todo |  |
| `StepsBuilder.jsRaw(...)` | `StepsBuilder.java` |  |  |  | todo |  |
| `StepsBuilder.replaceValue(...)` | `StepsBuilder.java` |  |  | counter flow possible | todo |  |
| `StepsBuilder.replaceExpression(...)` | `StepsBuilder.java` |  |  | counter flow possible | todo |  |
| `StepsBuilder.triggerEvent(...)` | `StepsBuilder.java` |  |  |  | todo |  |
| `StepsBuilder.emit(...)` | `StepsBuilder.java` |  |  |  | todo |  |
| `StepsBuilder.emitType(...)` | `StepsBuilder.java` |  |  |  | todo |  |
| `StepsBuilder.raw(...)` | `StepsBuilder.java` |  |  |  | todo |  |
| parity helper (`DslParityAssertions` equivalent) | `DslParityAssertions.java` |  |  | n/a | todo |  |
| counter end-to-end integration | `DocBuilderCounterIntegrationTest.java` |  |  | yes | todo |  |

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
