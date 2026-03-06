# BLUE TS DSL SDK — Stage 1 Mapping Matrix

Update this matrix during implementation.
It is the concise source of truth for how stage-1 DSL calls map to target BLUE document nodes.

Use it to track three things at once:
1. intended Java mapping behavior,
2. actual TS runtime-compatible mapping,
3. test coverage and any deviations.

If a runtime-correct implementation must differ from Java for an in-scope feature, keep the runtime behavior and add a matching entry in `stage-1-deviations.md`.

| DSL surface | Supported inputs | Target document effect | Java reference | Required tests | Runtime / deviation notes |
|---|---|---|---|---|---|
| `DocBuilder.doc()` | none | create empty working document | `DocBuilder.doc()` | `doc-builder.general.parity.test.ts` | implemented as new mutable builder over a fresh `BlueNode` |
| `DocBuilder.edit(existing)` | `BlueNode` | edit same underlying node | `DocBuilder.edit(...)` | `doc-builder.general.parity.test.ts` | preserves instance identity |
| `DocBuilder.from(existing)` | `BlueNode` | clone then edit | `DocBuilder.from(...)` | `doc-builder.general.parity.test.ts` | clones before mutation |
| `DocBuilder.expr(expression)` | string | wrap to `${...}` if needed | `DocBuilder.expr(...)` and `StepsBuilder.expr(...)` usage | `doc-builder.expr.test.ts` | no double wrapping |
| `.name(value)` | string | `/name` | `DocBuilder.name(...)` | `doc-builder.general.parity.test.ts` | uses `BlueNode.setName(...)` |
| `.description(value)` | string | `/description` | `DocBuilder.description(...)` | `doc-builder.general.parity.test.ts` | uses `BlueNode.setDescription(...)` |
| `.type(typeInput)` | alias / `{blueId}` / type node / zod schema | `/type` | `DocBuilder.type(...)` | `doc-builder.general.parity.test.ts`, `type-input.test.ts` | known aliases resolve to repository BlueIds; unknown aliases are preserved inline — see deviation |
| `.field(path, value)` | primitive / array / Blue-shaped object / `BlueNode` | set node at field path | `DocBuilder.field(path, value)` | `doc-builder.sections.parity.test.ts`, `pointer.test.ts` | tracks the field inside an active section |
| `.field(path)` builder | type / description / value / required / minimum / maximum | mutate or create node at path | `FieldBuilder` | `doc-builder.sections.parity.test.ts` | `done()` with no mutations does not create a placeholder node |
| `.replace(path, value)` | same as `field(path, value)` | set node at path | `DocBuilder.replace(...)` | `pointer.test.ts` | same pointer write helper as `.field(path, value)` |
| `.remove(path)` | pointer string | remove node at path | `DocBuilder.remove(...)` | `pointer.test.ts` | missing paths are ignored |
| `.channel(name)` | key | `/contracts/<key>` default channel contract | `DocBuilder.channel(String)` | `doc-builder.channels.parity.test.ts` | default contract type is `Core/Channel`, resolved to repository BlueId at authoring time |
| `.channel(name, contractLike)` | `BlueNode` or Blue-shaped object | specialize or replace `/contracts/<key>` | `DocBuilder.channel(String, Object)` | `doc-builder.channels.parity.test.ts` | merges with an existing contract when specializing a template |
| `.channels(...names)` | string[] | repeated default channels | `DocBuilder.channels(...)` | `doc-builder.channels.parity.test.ts` | repeated `.channel(name)` |
| `.compositeChannel(name, ...channelKeys)` | strings | composite channel contract | `DocBuilder.compositeChannel(...)` | `doc-builder.channels.parity.test.ts` | type resolves to runtime-known composite channel BlueId |
| `.section(key)` | key | begin section context | `DocBuilder.section(String)` | `doc-builder.sections.parity.test.ts` | reopens existing section metadata when present |
| `.section(key, title, summary)` | strings | begin section context | `DocBuilder.section(String,String,String)` | `doc-builder.sections.parity.test.ts` | only one open section at a time |
| `.endSection()` | none | write `Conversation/Document Section` contract | `DocBuilder.endSection()` | `doc-builder.sections.parity.test.ts` | writes related fields and related contract keys |
| inline `.operation(...)` | stage-1 overloads | create `/contracts/<op>` and optional `/contracts/<op>Impl` | `DocBuilder.operation(...)` overloads | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts` | impl key suffix is `Impl` |
| `.operation(key)` builder | key | create or update operation builder state | `OperationBuilder` | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts` | supports editing existing operations before adding an impl |
| operation `.channel(...)` | key | `/contracts/<op>/channel` | `OperationBuilder.channel(...)` | `doc-builder.operations.parity.test.ts` | falls back to existing channel on edit |
| operation `.description(...)` | text | `/contracts/<op>/description` | `OperationBuilder.description(...)` | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts` | stored as node description metadata |
| operation `.requestType(...)` | stage-1 type input | `/contracts/<op>/request/type` | `OperationBuilder.requestType(...)` | `doc-builder.general.parity.test.ts`, `type-input.test.ts` | request node uses `BlueNode.setType(...)` |
| operation `.request(...)` | request schema as `BlueNode` or Blue-shaped object | `/contracts/<op>/request` | `OperationBuilder.request(...)` | `doc-builder.operations.parity.test.ts` | accepts Blue-shaped object schemas directly |
| operation `.requestDescription(...)` | text | `/contracts/<op>/request/description` | `OperationBuilder.requestDescription(...)` | `doc-builder.general.parity.test.ts` | stored as request node description metadata |
| operation `.noRequest()` | none | remove `/contracts/<op>/request` | `OperationBuilder.noRequest()` | `doc-builder.general.parity.test.ts` | removes existing request schema on edit |
| operation `.steps(...)` | callback | create or update impl contract with steps array | `OperationBuilder.steps(...)` | `doc-builder.general.parity.test.ts`, `doc-builder.operations.parity.test.ts`, `doc-builder.counter.integration.test.ts` | appends steps when editing an existing implementation contract |
| `StepsBuilder.jsRaw(...)` | name, code | JavaScript code step | `StepsBuilder.jsRaw(...)` | `steps-builder.core.test.ts` | step type resolves to runtime-known JavaScript code BlueId |
| `StepsBuilder.replaceValue(...)` | name, path, value | update-document step with replace change | `StepsBuilder.replaceValue(...)` | `steps-builder.core.test.ts`, `doc-builder.general.parity.test.ts` | change entries use `{ op, path, val }` node objects |
| `StepsBuilder.replaceExpression(...)` | name, path, expression | update-document step with wrapped expression | `StepsBuilder.replaceExpression(...)` | `steps-builder.core.test.ts`, `doc-builder.general.parity.test.ts`, `doc-builder.counter.integration.test.ts` | wraps `${...}` on write |
| `StepsBuilder.triggerEvent(...)` | name, `BlueNode` event | trigger-event step | `StepsBuilder.triggerEvent(...)` | `steps-builder.core.test.ts` | requires a non-empty step name |
| `StepsBuilder.emit(...)` | Blue-shaped event or `BlueNode` | trigger-event step | `StepsBuilder.emit(...)` | `steps-builder.core.test.ts` | Blue-shaped objects are converted through repository-backed `Blue.jsonValueToNode(...)` |
| `StepsBuilder.emitType(...)` | name, type input, optional payload customizer | trigger-event step with typed event node | `StepsBuilder.emitType(...)` | `steps-builder.core.test.ts`, `doc-builder.operations.parity.test.ts` | payload customizer mutates the event node before wrapping it in a trigger step |
| `StepsBuilder.raw(...)` | step `BlueNode` | append raw step clone | `StepsBuilder.raw(...)` | `steps-builder.core.test.ts` | preserves caller immutability by cloning the supplied step |
| `.buildDocument()` | none | return built node | `DocBuilder.buildDocument()` | `doc-builder.general.parity.test.ts`, `doc-builder.sections.parity.test.ts` | throws if a section is left open |
