# BLUE TS DSL SDK — Stage 1 Mapping Matrix

This matrix reflects the implemented stage-1 mapping behavior.

| DSL surface | Supported inputs | Target document effect | Java reference | Required tests | Runtime / deviation notes |
|---|---|---|---|---|---|
| `DocBuilder.doc()` | none | create empty working document | `DocBuilder.doc()` | general parity | returns a new builder over a new node |
| `DocBuilder.edit(existing)` | `BlueNode` | edit the same underlying node | `DocBuilder.edit(...)` | general parity | preserves instance identity |
| `DocBuilder.from(existing)` | `BlueNode` | clone then edit | `DocBuilder.from(...)` | general parity | clone before mutation |
| `DocBuilder.expr(expression)` | string | wrap to `${...}` if needed | `DocBuilder.expr(...)` | core unit | no double wrapping |
| `.name(value)` | string | document metadata name | `DocBuilder.name(...)` | general parity | stored as node metadata |
| `.description(value)` | string | document metadata description | `DocBuilder.description(...)` | general parity | stored as node metadata |
| `.type(typeInput)` | alias, `{blueId}`, `BlueNode`, annotated Zod schema | document type node | `DocBuilder.type(...)` | general parity + core unit | known aliases normalize through repository-backed `Blue`; unknown aliases stay inline. See deviation. |
| `.field(path, value)` | primitive, array, plain object, `BlueNode` | set node at field path | `DocBuilder.field(path, value)` | sections parity | uses pointer helper and tracks the field during active sections |
| `.field(path)` builder | type, description, value, required, minimum, maximum | mutate or create node at path | `FieldBuilder` | sections parity | `done()` without mutation keeps Java tracking semantics; constraints become a `constraints` child node |
| `.replace(path, value)` | same as `.field(path, value)` | replace node at path | `DocBuilder.replace(...)` | core unit | uses the same pointer helper and section field tracking as `.field(path, value)` |
| `.remove(path)` | pointer string | remove node at path | `DocBuilder.remove(...)` | core unit | removes the node without section tracking side effects |
| `.channel(name)` | key | `/contracts/<key>` default channel contract | `DocBuilder.channel(String)` | channels parity | emits `Core/Channel` |
| `.channel(name, contractLike)` | `BlueNode` or plain object | specialize `/contracts/<key>` | `DocBuilder.channel(String, Object)` | channels parity | merges onto existing/default contract and preserves runtime type defaults; see plain-object deviation |
| `.channels(...names)` | string[] | repeated default channel contracts | `DocBuilder.channels(...)` | channels parity | sugar over repeated `.channel(name)` |
| `.compositeChannel(name, ...channelKeys)` | strings | composite channel contract | `DocBuilder.compositeChannel(...)` | channels parity | writes `Conversation/Composite Timeline Channel` with `channels` list |
| `.section(key)` | key | begin section context | `DocBuilder.section(String)` | sections parity | default title equals key; only one open section at a time |
| `.section(key, title, summary)` | strings | begin section context | `DocBuilder.section(String,String,String)` | sections parity | reopens existing section contract if present |
| `.endSection()` | none | write `Conversation/Document Section` contract | `DocBuilder.endSection()` | sections parity | uses tracked fields and contracts collected while the section is open |
| inline `.operation(...)` | stage-1 overloads | create operation contract and optional impl contract | `DocBuilder.operation(...)` overloads | general + operations parity | implementation contracts use `<key>Impl` |
| `.operation(key)` builder | key | build or edit operation state | `OperationBuilder` | operations parity | supports editing existing operation contracts |
| operation `.channel(...)` | key | `/contracts/<op>/channel` | `OperationBuilder.channel(...)` | operations parity | required by `done()` if no existing channel is present |
| operation `.description(...)` | text | operation description metadata | `OperationBuilder.description(...)` | general + operations parity | stored as node description metadata, matching Java external BLUE shape |
| operation `.requestType(...)` | stage-1 `typeInput` | `/contracts/<op>/request/type` | `OperationBuilder.requestType(...)` | general + operations parity | same type-input rules as `.type(...)` |
| operation `.request(...)` | `BlueNode` or plain object | `/contracts/<op>/request` | `OperationBuilder.request(...)` | operations parity | plain-object requests use a local schema converter so `{ type: 'List', items: [...] }` maps like Java. See plain-object deviation. |
| operation `.requestDescription(...)` | text | request description metadata | `OperationBuilder.requestDescription(...)` | general parity | request node is created if absent, then description metadata is applied |
| operation `.noRequest()` | none | remove `/contracts/<op>/request` | `OperationBuilder.noRequest()` | operations parity | important for edit flows |
| operation `.steps(...)` | callback | create or append implementation steps | `OperationBuilder.steps(...)` | general + operations parity | existing impl contracts are reused and appended to |
| `StepsBuilder.jsRaw(...)` | name, code | JavaScript code step | `StepsBuilder.jsRaw(...)` | steps core | emits `Conversation/JavaScript Code` |
| `StepsBuilder.replaceValue(...)` | name, path, value | update-document step with replace change | `StepsBuilder.replaceValue(...)` | steps core | wraps value in a change entry under `changeset` |
| `StepsBuilder.replaceExpression(...)` | name, path, expression | update-document step with wrapped expression | `StepsBuilder.replaceExpression(...)` | general parity + steps core | stores `${...}` through `DocBuilder.expr(...)` |
| `StepsBuilder.triggerEvent(...)` | name, `BlueNode` event | trigger-event step | `StepsBuilder.triggerEvent(...)` | steps core | clones event input through public conversion |
| `StepsBuilder.emit(...)` | plain object or `BlueNode` event | trigger-event step | `StepsBuilder.emit(...)` | steps core | uses plain-object support instead of Java bean reflection |
| `StepsBuilder.emitType(...)` | name, type input, optional payload customizer | trigger-event step with typed event node | `StepsBuilder.emitType(...)` | steps core + operations parity | payload customizer mutates the event node before it is emitted |
| `StepsBuilder.raw(...)` | step `BlueNode` | append raw step clone | `StepsBuilder.raw(...)` | steps core | preserves caller immutability |
| `.buildDocument()` | none | return current `BlueNode` | `DocBuilder.buildDocument()` | general + sections parity | throws if a section is still open |
