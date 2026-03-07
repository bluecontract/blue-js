# BLUE TS DSL SDK — Stage 2 Mapping Matrix

Java remains the primary mapping reference.
The current TypeScript runtime remains the execution gate.

## Handler authoring

| DSL expression | Generated mapping | Java reference | Tests | Notes |
|---|---|---|---|---|
| `.onInit('initialize', steps => ...)` | `initLifecycleChannel` as `Core/Lifecycle Event Channel` with channel-level event `Core/Document Processing Initiated`, plus workflow `initialize` bound to it | `DocBuilderGeneralDslParityTest.onInitMatchesYamlDefinition` | `DocBuilder.general.parity.test.ts`, `DocBuilder.sections.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | runtime alias deviation, see [stage-2-deviations.md](./stage-2-deviations.md); section coverage asserts `relatedContracts` keeps `initLifecycleChannel` |
| `.onEvent('onNumber', type, steps => ...)` | `triggeredEventChannel` as `Core/Triggered Event Channel`, plus workflow `onNumber` with workflow-level `event` matcher | `DocBuilderGeneralDslParityTest.onEventMatchesYamlDefinition` | `DocBuilder.general.parity.test.ts`, `DocBuilder.sections.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | matcher uses stage-1 `TypeInput` resolution; section coverage asserts `relatedContracts` keeps `triggeredEventChannel` |
| `.onNamedEvent('onReady', 'ready', steps => ...)` | `triggeredEventChannel` plus workflow `onReady` whose matcher event uses type `Common/Named Event` and property `name` | `DocBuilderGeneralDslParityTest.onNamedEventMatchesYamlDefinition` | `DocBuilder.general.parity.test.ts`, `DocBuilder.sections.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | runtime-compatible unresolved named-event type, see [stage-2-deviations.md](./stage-2-deviations.md); section coverage asserts `relatedContracts` keeps `triggeredEventChannel` |
| `.onDocChange('watchPrice', '/price', steps => ...)` | `watchPriceDocUpdateChannel` as `Core/Document Update Channel` with `path`, plus workflow `watchPrice` bound to it with event `Core/Document Update` | `DocBuilderGeneralDslParityTest.onDocChangeMatchesYamlDefinition` | `DocBuilder.general.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | generated channel key is deterministic |
| `.onChannelEvent('onIncrementEvent', 'ownerChannel', type, steps => ...)` | workflow bound to `ownerChannel` with workflow-level `event` matcher | `DocBuilderChannelsDslParityTest.onChannelEventMatchesYamlDefinition` | `DocBuilder.channels.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | parity is green; public runtime limitation is documented in [stage-2-deviations.md](./stage-2-deviations.md) |

## Step authoring

| DSL expression | Generated mapping | Java reference | Tests | Notes |
|---|---|---|---|---|
| `.updateDocument('ApplyPatch', changeset => ...)` | `Conversation/Update Document` with inline `changeset` array | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | `DocBuilder.steps.parity.test.ts` | uses `ChangesetBuilder` |
| `.updateDocumentFromExpression('ApplyDynamic', 'steps.Compute.nextChangeset')` | `Conversation/Update Document` with expression-valued `changeset` | same | `DocBuilder.steps.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | wraps `${...}` exactly once |
| `.namedEvent('EmitReady', 'READY')` | `Conversation/Trigger Event` whose `event` node is `Common/Named Event` with required `name` | same | `DocBuilder.steps.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | blank names rejected; runtime named-event deviation applies |
| `.namedEvent('EmitPayload', 'READY', payload => payload.put(...))` | same as above, plus `payload` object | same | `DocBuilder.steps.parity.test.ts` | payload builder preserves insertion order |
| `.emitType('EmitTyped', type, payload => payload.put(...))` | `Conversation/Trigger Event` with typed event node and Java-like payload builder helpers | same | `DocBuilder.steps.parity.test.ts`, `StepsBuilder.core.test.ts` | payload builder still supports legacy `.addProperty(...)` style |
| `.bootstrapDocument('BootstrapNode', node, bindings)` | `Conversation/Document Bootstrap Requested` emitted via `Conversation/Trigger Event` | `DocBuilderStepsDslParityTest.bootstrapDocumentBuildersMapDocumentBindingsAndOptions` | `DocBuilder.steps.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | channel bindings serialize to a string-keyed dictionary |
| `.bootstrapDocument(..., options => ...)` | same plus `bootstrapAssignee` and `initialMessages` | same | `DocBuilder.steps.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | `channelMessage(...)` ignores blank channel keys |
| `.bootstrapDocumentExpr('BootstrapExpr', "document('/child')", bindings, ...)` | same event with expression-valued `document` | same | `DocBuilder.steps.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | blank expression rejected; runtime coverage confirms the expression resolves before bootstrap emission |
| `.ext(factory)` | returns a custom extension object bound to the current `StepsBuilder` | `DocBuilderStepsDslParityTest.extRejectsNullFactoriesAndNullExtensions`, `extSupportsCustomStepExtensions` | `DocBuilder.steps.parity.test.ts` | null factory and null return rejected |

## ChangesetBuilder

| Builder call | Serialized patch entry | Java reference | Tests | Notes |
|---|---|---|---|---|
| `.replaceValue('/x', 1)` | `{ op: 'replace', path: '/x', val: 1 }` | `ChangesetBuilder.java` | `DocBuilder.steps.parity.test.ts`, `ChangesetBuilder.guardrails.test.ts` | |
| `.replaceExpression('/x', "document('/y')")` | `{ op: 'replace', path: '/x', val: "${document('/y')}" }` | `ChangesetBuilder.java` | same | |
| `.addValue('/items/0', 'a')` | `{ op: 'add', path: '/items/0', val: 'a' }` | `ChangesetBuilder.java` | same | |
| `.remove('/obsolete')` | `{ op: 'remove', path: '/obsolete' }` | `ChangesetBuilder.java` | same | |
| blank path | throws `Patch path cannot be empty` | `ChangesetBuilder.java` | `ChangesetBuilder.guardrails.test.ts` | |
| reserved processor path | throws | `ChangesetBuilder.java` | `ChangesetBuilder.guardrails.test.ts` | protects `/contracts/checkpoint`, `/contracts/embedded`, `/contracts/initialized`, `/contracts/terminated` |

## Bootstrap options

| Builder call | Serialized field(s) | Java reference | Tests | Notes |
|---|---|---|---|---|
| `.assignee('orchestratorChannel')` | `bootstrapAssignee` | `BootstrapOptionsBuilder.java` | `DocBuilder.steps.parity.test.ts`, `DocBuilder.handlers.integration.test.ts` | |
| `.defaultMessage('You have been added.')` | `initialMessages.defaultMessage` | same | same | |
| `.channelMessage('participantA', 'Please review.')` | `initialMessages.perChannel.participantA` | same | same | blank channel keys are ignored |
