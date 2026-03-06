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
| `DocBuilder.doc()` | none | create empty working document | `DocBuilder.doc()` | general parity | returns new builder over new node |
| `DocBuilder.edit(existing)` | `BlueNode` | edit same underlying node | `DocBuilder.edit(...)` | general parity + guardrail | must preserve instance identity |
| `DocBuilder.from(existing)` | `BlueNode` | clone then edit | `DocBuilder.from(...)` | general parity + guardrail | clone before mutation |
| `DocBuilder.expr(expression)` | string | wrap to `${...}` if needed | `DocBuilder.expr(...)` and `StepsBuilder.expr(...)` usage | unit tests | no double wrapping |
| `.name(value)` | string | `/name` | `DocBuilder.name(...)` | general parity |  |
| `.description(value)` | string | `/description` | `DocBuilder.description(...)` | general parity |  |
| `.type(typeInput)` | alias / `{blueId}` / type node / zod schema | `/type` | `DocBuilder.type(...)` | general parity + unit | TS adapts Java `Class<?>` |
| `.field(path, value)` | primitive / array / Blue-shaped object / `BlueNode` | set node at field path | `DocBuilder.field(path, value)` | sections/general parity | also tracks field in active section |
| `.field(path)` builder | type / description / value / required / minimum / maximum | mutate or create node at path | `FieldBuilder` | sections parity | `done()` without mutation should still keep tracking semantics aligned with Java intent |
| `.replace(path, value)` | same as `field(path, value)` | set node at path | `DocBuilder.replace(...)` | direct behavior tests | also tracks field in active section |
| `.remove(path)` | pointer string | remove node at path | `DocBuilder.remove(...)` | direct behavior tests | no field tracking side-effect |
| `.channel(name)` | key | `/contracts/<key>` default channel contract | `DocBuilder.channel(String)` | channels parity | use runtime-correct default contract shape |
| `.channel(name, contractLike)` | `BlueNode` or Blue-shaped object | `/contracts/<key> = provided contract` | `DocBuilder.channel(String, Object)` | channels parity | specializes or replaces existing contract |
| `.channels(...names)` | string[] | repeated default channels | `DocBuilder.channels(...)` | channels parity |  |
| `.compositeChannel(name, ...channelKeys)` | strings | composite channel contract | `DocBuilder.compositeChannel(...)` | channels parity | type should stay runtime-correct |
| `.section(key)` | key | begin section context | `DocBuilder.section(String)` | sections parity | default title should follow Java/reference intent |
| `.section(key, title, summary)` | strings | begin section context | `DocBuilder.section(String,String,String)` | sections parity | one open section at a time |
| `.endSection()` | none | write `Conversation/Document Section` contract | `DocBuilder.endSection()` | sections parity | uses tracked fields/contracts |
| inline `.operation(...)` | stage-1 overloads | create `/contracts/<op>` and optional `/contracts/<op>Impl` | `DocBuilder.operation(...)` overloads | general + operations parity | impl key suffix `Impl` |
| `.operation(key)` builder | key | create or update operation builder state | `OperationBuilder` | operations parity | should support editing existing operation contract |
| operation `.channel(...)` | key | `/contracts/<op>/channel` | `OperationBuilder.channel(...)` | operations parity | required by `done()` |
| operation `.description(...)` | text | `/contracts/<op>/description` | `OperationBuilder.description(...)` | general/operations parity |  |
| operation `.requestType(...)` | stage-1 type input | `/contracts/<op>/request/type` | `OperationBuilder.requestType(...)` | general/operations parity | TS adapts Java `Class<?>` |
| operation `.request(...)` | request schema as `BlueNode` or Blue-shaped object | `/contracts/<op>/request` | `OperationBuilder.request(...)` | operations parity | used for object/list schema |
| operation `.requestDescription(...)` | text | `/contracts/<op>/request/description` | `OperationBuilder.requestDescription(...)` | general parity | applied after request node exists |
| operation `.noRequest()` | none | remove `/contracts/<op>/request` | `OperationBuilder.noRequest()` | operations parity | especially important in edit flows |
| operation `.steps(...)` | callback | create or update impl contract with steps array | `OperationBuilder.steps(...)` | general + operations parity | impl contract type should remain runtime-correct |
| `StepsBuilder.jsRaw(...)` | name, code | JavaScript code step | `StepsBuilder.jsRaw(...)` | direct unit + operations parity | type `Conversation/JavaScript Code` |
| `StepsBuilder.replaceValue(...)` | name, path, value | update-document step with replace change | `StepsBuilder.replaceValue(...)` | general parity + unit | uses changeset array |
| `StepsBuilder.replaceExpression(...)` | name, path, expression | update-document step with wrapped expression | `StepsBuilder.replaceExpression(...)` | general parity + unit | wraps `${...}` |
| `StepsBuilder.triggerEvent(...)` | name, `BlueNode` event | trigger-event step | `StepsBuilder.triggerEvent(...)` | direct unit | type `Conversation/Trigger Event` |
| `StepsBuilder.emit(...)` | Blue-shaped event or `BlueNode` | trigger-event step | `StepsBuilder.emit(...)` | direct unit | stage 1 uses Blue-shaped data, not Java bean reflection |
| `StepsBuilder.emitType(...)` | name, type input, optional payload customizer | trigger-event step with typed event node | `StepsBuilder.emitType(...)` | operations parity + unit | payload customizer adds event properties |
| `StepsBuilder.raw(...)` | step `BlueNode` | append raw step clone | `StepsBuilder.raw(...)` | unit tests | preserve caller immutability |
| `.buildDocument()` | none | return built node | `DocBuilder.buildDocument()` | general + sections parity | throws if section left open |
