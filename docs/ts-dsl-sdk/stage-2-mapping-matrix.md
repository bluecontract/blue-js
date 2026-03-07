# BLUE TS DSL SDK — Stage 2 Mapping Matrix

This matrix defines the expected stage-2 DSL → document mappings.
Java is the primary reference for intent.
The current TypeScript runtime is the final execution gate.

## Handler authoring

| DSL expression | Expected generated contracts / steps | Java reference | Required tests | Notes |
|---|---|---|---|---|
| `.onInit('initialize', steps => ...)` | `initLifecycleChannel` + workflow `initialize` bound to it | `DocBuilderGeneralDslParityTest.onInitMatchesYamlDefinition` | parity + runtime | `initLifecycleChannel` should be reused if already present |
| `.onEvent('onNumber', type, steps => ...)` | `triggeredEventChannel` + workflow `onNumber` with event matcher | `DocBuilderGeneralDslParityTest.onEventMatchesYamlDefinition` | parity + runtime | event type uses stage-1 type-input model |
| `.onNamedEvent('onReady', 'ready', steps => ...)` | `triggeredEventChannel` + workflow `onReady` with named-event matcher | `DocBuilderGeneralDslParityTest.onNamedEventMatchesYamlDefinition` | parity + runtime | canonical named-event type if available; otherwise documented runtime-compatible fallback |
| `.onDocChange('watchPrice', '/price', steps => ...)` | `watchPriceDocUpdateChannel` + workflow `watchPrice` bound to it | `DocBuilderGeneralDslParityTest.onDocChangeMatchesYamlDefinition` | parity + runtime | generated doc-update channel name is deterministic |
| `.onChannelEvent('onIncrementEvent', 'ownerChannel', type, steps => ...)` | workflow bound to existing `ownerChannel` with event matcher | `DocBuilderChannelsDslParityTest.onChannelEventMatchesYamlDefinition` | parity + runtime-if-clean | runtime test only if public processor API supports it cleanly |

## Step authoring

| DSL expression | Expected generated step shape | Java reference | Required tests | Notes |
|---|---|---|---|---|
| `.updateDocument('ApplyPatch', changeset => ...)` | `Conversation/Update Document` with inline `changeset` array | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | parity + runtime | use `ChangesetBuilder` |
| `.updateDocumentFromExpression('ApplyDynamic', 'steps.Compute.nextChangeset')` | `Conversation/Update Document` with expression-valued `changeset` | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | parity + runtime | expression must be wrapped exactly once |
| `.namedEvent('EmitReady', 'READY')` | `Conversation/Trigger Event` with named-event payload | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | parity + runtime | blank names invalid |
| `.namedEvent('EmitPayload', 'READY', payload => payload.put(...))` | same as above, plus `payload` object | same | parity + runtime | payload builder should preserve insertion order |
| `.bootstrapDocument('BootstrapNode', node, bindings)` | `Conversation/Document Bootstrap Requested` emitted event | `DocBuilderStepsDslParityTest.bootstrapDocumentBuildersMapDocumentBindingsAndOptions` | parity + emitted-event runtime | node document mode |
| `.bootstrapDocument(..., options => ...)` | same + bootstrap options fields | same | parity + emitted-event runtime | `bootstrapAssignee`, `initialMessages` |
| `.bootstrapDocumentExpr('BootstrapExpr', "document('/child')", bindings, ...)` | same event with expression-valued `document` | same | parity + emitted-event runtime | blank expression invalid |
| `.ext(factory)` | returns a custom extension object bound to current steps builder | `DocBuilderStepsDslParityTest.extRejectsNullFactoriesAndNullExtensions` and `extSupportsCustomStepExtensions` | guardrail + parity | generic extension hook only |

## ChangesetBuilder

| Builder call | Expected patch entry | Java reference | Required tests | Notes |
|---|---|---|---|---|
| `.replaceValue('/x', 1)` | `{ op: 'replace', path: '/x', val: 1 }` | `ChangesetBuilder.java` | parity + unit | |
| `.replaceExpression('/x', "document('/y')")` | `{ op: 'replace', path: '/x', val: "${document('/y')}" }` | `ChangesetBuilder.java` | parity + unit | |
| `.addValue('/items/0', 'a')` | `{ op: 'add', path: '/items/0', val: 'a' }` | `ChangesetBuilder.java` | parity + unit | |
| `.remove('/obsolete')` | `{ op: 'remove', path: '/obsolete' }` | `ChangesetBuilder.java` | parity + unit | |
| invalid blank / reserved path | throws | `ChangesetBuilder.java` | guardrail | reserved processor-relative paths must be protected |

## Bootstrap options

| Builder call | Expected serialized field(s) | Java reference | Required tests | Notes |
|---|---|---|---|---|
| `.assignee('orchestratorChannel')` | `bootstrapAssignee` | `BootstrapOptionsBuilder.java` | parity | |
| `.defaultMessage('You have been added.')` | `initialMessages.defaultMessage` | same | parity | |
| `.channelMessage('participantA', 'Please review.')` | `initialMessages.perChannel.participantA` | same | parity | blank channel keys ignored |

## Deviation handling
If the current runtime requires a mapping different from Java for an in-scope feature:
1. keep the runtime-correct mapping,
2. document it in `stage-2-deviations.md`,
3. add a focused regression test,
4. keep the difference visible in the coverage matrix.
