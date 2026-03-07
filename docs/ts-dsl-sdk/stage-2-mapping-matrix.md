# BLUE TS DSL SDK — Stage 2 Mapping Matrix

This matrix defines the expected stage-2 DSL → document mappings.
Java is the primary reference for intent.
The current TypeScript runtime is the final execution gate.

## Handler authoring

| DSL expression | Expected generated contracts / steps | Java reference | Required tests | Notes |
|---|---|---|---|---|
| `.onInit('initialize', steps => ...)` | `initLifecycleChannel` + workflow `initialize` bound to it | `DocBuilderGeneralDslParityTest.onInitMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | runtime-correct channel alias is `Core/Lifecycle Event Channel`; channel is reused when present |
| `.onEvent('onNumber', type, steps => ...)` | `triggeredEventChannel` + workflow `onNumber` with event matcher | `DocBuilderGeneralDslParityTest.onEventMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | runtime integration uses an init-emitted triggered event because the public processor drains triggered events from the internal emitted-event queue |
| `.onNamedEvent('onReady', 'ready', steps => ...)` | `triggeredEventChannel` + workflow `onReady` with named-event matcher | `DocBuilderGeneralDslParityTest.onNamedEventMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | uses `Common/Named Event`; see deviations for parser/runtime caveats |
| `.onDocChange('watchPrice', '/price', steps => ...)` | `watchPriceDocUpdateChannel` + workflow `watchPrice` bound to it | `DocBuilderGeneralDslParityTest.onDocChangeMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | runtime-correct generated channel alias is `Core/Document Update Channel`; generated channel name is deterministic |
| `.onChannelEvent('onIncrementEvent', 'ownerChannel', type, steps => ...)` | workflow bound to existing `ownerChannel` with event matcher | `DocBuilderChannelsDslParityTest.onChannelEventMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts` | parity covered; runtime clean-room exercise is limited by current public processor event-channel delivery shape — see deviation |

## Step authoring

| DSL expression | Expected generated step shape | Java reference | Required tests | Notes |
|---|---|---|---|---|
| `.updateDocument('ApplyPatch', changeset => ...)` | `Conversation/Update Document` with inline `changeset` array | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | `doc-builder.steps.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | uses local `ChangesetBuilder` |
| `.updateDocumentFromExpression('ApplyDynamic', 'steps.Compute.nextChangeset')` | `Conversation/Update Document` with expression-valued `changeset` | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | `doc-builder.steps.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | expression is wrapped exactly once |
| `.namedEvent('EmitReady', 'READY')` | `Conversation/Trigger Event` with named-event payload | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | `doc-builder.steps.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | blank names invalid; named-event-specific parity uses programmatic expected nodes |
| `.namedEvent('EmitPayload', 'READY', payload => payload.put(...))` | same as above, plus `payload` object | same | `doc-builder.steps.parity.test.ts` | payload builder preserves node insertion order |
| `.bootstrapDocument('BootstrapNode', node, bindings)` | `Conversation/Document Bootstrap Requested` emitted event | `DocBuilderStepsDslParityTest.bootstrapDocumentBuildersMapDocumentBindingsAndOptions` | `doc-builder.steps.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | node document mode |
| `.bootstrapDocument(..., options => ...)` | same + bootstrap options fields | same | `doc-builder.steps.parity.test.ts`, `doc-builder.workflows.integration.test.ts` | populates `bootstrapAssignee`, `initialMessages.defaultMessage`, and `initialMessages.perChannel` |
| `.bootstrapDocumentExpr('BootstrapExpr', "document('/child')", bindings, ...)` | same event with expression-valued `document` | same | `doc-builder.steps.parity.test.ts` | blank expression invalid |
| `.ext(factory)` | returns a custom extension object bound to current steps builder | `DocBuilderStepsDslParityTest.extRejectsNullFactoriesAndNullExtensions` and `extSupportsCustomStepExtensions` | `doc-builder.steps.parity.test.ts` | generic extension hook only |

## ChangesetBuilder

| Builder call | Expected patch entry | Java reference | Required tests | Notes |
|---|---|---|---|---|
| `.replaceValue('/x', 1)` | `{ op: 'replace', path: '/x', val: 1 }` | `ChangesetBuilder.java` | `changeset-builder.test.ts`, `doc-builder.steps.parity.test.ts` | |
| `.replaceExpression('/x', "document('/y')")` | `{ op: 'replace', path: '/x', val: "${document('/y')}" }` | `ChangesetBuilder.java` | `changeset-builder.test.ts`, `doc-builder.steps.parity.test.ts` | |
| `.addValue('/items/0', 'a')` | `{ op: 'add', path: '/items/0', val: 'a' }` | `ChangesetBuilder.java` | `changeset-builder.test.ts`, `doc-builder.steps.parity.test.ts` | |
| `.remove('/obsolete')` | `{ op: 'remove', path: '/obsolete' }` | `ChangesetBuilder.java` | `changeset-builder.test.ts`, `doc-builder.steps.parity.test.ts` | |
| invalid blank / reserved path | throws | `ChangesetBuilder.java` | `changeset-builder.test.ts` | protects `/contracts/checkpoint`, `/contracts/embedded`, `/contracts/initialized`, `/contracts/terminated` |

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
