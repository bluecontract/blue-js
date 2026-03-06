# Document Processor parity checklist

Pinned target: `blue-js` commit `bf9e1cfd200d35801d8237f7080895372c1572c6` (`libs/document-processor`)

Status legend:

- `DONE` — behavior implemented in Java and covered by tests
- `IN_PROGRESS` — partially aligned, gaps remain
- `TODO` — not yet implemented

---

## 1) Engine/runtime surface

| Area | JS reference | Java reference | Status |
|---|---|---|---|
| Processor engine orchestration | `src/engine/processor-engine.ts` | `processor/ProcessorEngine.java` | DONE |
| Scope executor lifecycle | `src/engine/scope-executor.ts` | `processor/ScopeExecutor.java` | DONE |
| Channel runner + checkpoints | `src/engine/channel-runner.ts` | `processor/ChannelRunner.java` | DONE |
| Contract loader validation | `src/engine/contract-loader.ts` | `processor/ContractLoader.java` | DONE |
| Contract bundle semantics | `src/engine/contract-bundle.ts` | `processor/ContractBundle.java` | DONE |
| Patch engine | `src/runtime/patch-engine.ts` | `processor/PatchEngine.java` | DONE |
| Runtime state + emissions | `src/runtime/document-processing-runtime.ts` | `processor/DocumentProcessingRuntime.java` | DONE |
| Termination service semantics | `src/engine/termination-service.ts` | `processor/TerminationService.java` | DONE |

## 2) Default processors and registry

| Area | JS reference | Java reference | Status |
|---|---|---|---|
| Registry lookup by BlueId/type chain | `src/registry/contract-processor-registry.ts` | `processor/ContractProcessorRegistry.java` | DONE |
| Default processor registration | `src/registry/contract-processor-registry-builder.ts` | `processor/ContractProcessorRegistryBuilder.java` | DONE |
| Timeline channel processor | `src/registry/processors/timeline-channel-processor.ts` | `processor/registry/processors/TimelineChannelProcessor.java` | DONE |
| Composite timeline channel processor | `src/registry/processors/composite-timeline-channel-processor.ts` | `processor/registry/processors/CompositeTimelineChannelProcessor.java` | DONE |
| MyOS timeline channel processor | `src/registry/processors/myos-timeline-channel-processor.ts` | `processor/registry/processors/MyOSTimelineChannelProcessor.java` | DONE |
| Sequential workflow handler processor | `src/registry/processors/sequential-workflow-processor.ts` | `processor/registry/processors/SequentialWorkflowHandlerProcessor.java` | DONE |
| Sequential workflow operation processor | `src/registry/processors/sequential-workflow-operation-processor.ts` | `processor/registry/processors/SequentialWorkflowOperationProcessor.java` | DONE |
| Operation marker processor | `src/registry/processors/operation-marker-processor.ts` | `processor/registry/processors/OperationMarkerProcessor.java` | DONE |

## 3) Expression + QuickJS runtime

| Area | JS reference | Java reference | Status |
|---|---|---|---|
| QuickJS evaluator | `src/util/expression/quickjs-evaluator.ts` | `processor/script/QuickJSEvaluator.java` | DONE |
| Expression utils/traversal | `src/util/expression/quickjs-expression-utils.ts` | `processor/script/QuickJsExpressionUtils.java` | DONE |
| QuickJS config exports | `src/util/expression/quickjs-config.ts` | `processor/script/QuickJsConfig.java` | DONE |
| Script runtime integration | JS runtime usage in evaluator/steps | `processor/script/*`, `tools/quickjs-sidecar/index.js` | DONE |
| JavaScript Code step | `src/registry/processors/steps/javascript-code-step-executor.ts` | `processor/workflow/steps/JavaScriptCodeStepExecutor.java` | DONE |

## 4) Workflow step runtime

| Area | JS reference | Java reference | Status |
|---|---|---|---|
| Step runner framework | `src/registry/processors/workflow/step-runner.ts` | `processor/workflow/WorkflowStepRunner.java` | DONE |
| Update Document step | `src/registry/processors/steps/update-document-step-executor.ts` | `processor/workflow/steps/UpdateDocumentStepExecutor.java` | DONE |
| Trigger Event step | `src/registry/processors/steps/trigger-event-step-executor.ts` | `processor/workflow/steps/TriggerEventStepExecutor.java` | DONE |
| Operation matcher helpers | `src/registry/processors/workflow/operation-matcher.ts` | `processor/registry/processors/SequentialWorkflowOperationProcessor.java` | DONE |

## 5) Merge behavior

| Area | JS reference | Java reference | Status |
|---|---|---|---|
| ExpressionPreserver | `src/merge/processors/ExpressionPreserver.ts` | `merge/processor/ExpressionPreserver.java` | DONE |
| Default merge pipeline ordering | `src/merge/utils/default.ts` | `Blue#createDefaultNodeProcessor` | DONE |

## 6) Constants, pointers, error/result model

| Area | JS reference | Java reference | Status |
|---|---|---|---|
| Processor constants | `src/constants/processor-contract-constants.ts` | `processor/util/ProcessorContractConstants.java` | DONE |
| Pointer constants | `src/constants/processor-pointer-constants.ts` | `processor/util/ProcessorPointerConstants.java` | DONE |
| Pointer utils | `src/util/pointer-utils.ts` | `processor/util/PointerUtils.java` | DONE |
| Processing result shape | `src/types/document-processing-result.ts` | `processor/DocumentProcessingResult.java` | DONE |
| Processor error factory model | `src/types/errors.ts` | `processor/types/*` | DONE |

## 7) Gas accounting + canonicalization

| Area | JS reference | Java reference | Status |
|---|---|---|---|
| Canonical signature/size helpers | `src/util/node-canonicalizer.ts` | `processor/util/NodeCanonicalizer.java` + `ProcessorEngine#canonicalSignature` | DONE |
| Gas meter methods | `src/runtime/gas-meter.ts` | `processor/GasMeter.java` | DONE |
| Gas schedule conversions | `src/runtime/gas-schedule.ts` | `processor/ProcessorGasSchedule.java` | DONE |

## 8) Test coverage mapping

| Area | JS tests | Java tests | Status |
|---|---|---|---|
| Constants/pointers | `src/constants/__tests__/*`, `src/util/__tests__/pointer-utils.test.ts` | `processor/util/*Test.java` | DONE |
| API facade | `src/api/__tests__/document-processor.test.ts` | `DocumentProcessorApiParityTest`, `DocumentProcessorInitializationTest`, `DocumentProcessorCapabilityTest` | DONE |
| Runtime core | `src/runtime/__tests__/*` | `processor/DocumentProcessingRuntime*Test.java`, `DocumentProcessingRuntimeParityTest`, `PatchEngineParityTest`, `ScopeRuntimeContextTest`, `EmissionRegistryTest.java` | DONE |
| Engine core | `src/engine/__tests__/*` | `processor/*Boundary*`, `CheckpointManagerTest`, `ChannelRunnerTest`, `ContractBundleParityTest`, `ContractLoaderParityTest`, `ScopeExecutorParityTest`, `ScopeExecutorDerivedChannelParityTest`, `TerminationServiceParityTest`, etc. | DONE |
| Contract model schemas | `src/model/__tests__/contract-models.test.ts` | `ContractModelsParityTest`, `ContractMappingIntegrationTest` | DONE |
| Registry/timeline/workflow | `src/registry/__tests__/*` | `ContractProcessorRegistryTest`, `ContractProcessorRegistryBuilderDefaultsTest`, `CompositeTimelineChannelProcessorTest`, `CompositeTimelineChannelIntegrationParityTest`, `TimelineChannelProcessorTest`, `TimelineChannelProcessorIntegrationParityTest`, `MyOSTimelineChannelProcessorTest`, `MyOSTimelineChannelIntegrationParityTest`, `SequentialWorkflowProcessorTest`, `SequentialWorkflowHandlerProcessorIntegrationParityTest`, `DeepEmbeddedInitializationPropagationTest`, `DeepEmbeddedPropagationIntegrationTest`, `CrossTriggeringIntegrationTest`, `ProcessMultiPathsIntegrationTest`, `ProcessProtectedPathRemovalTerminatesRootIntegrationTest`, `DynamicWorkflowRegistrationIntegrationTest`, `SharedTimelineCheckpointIntegrationTest`, `TriggerEventIntegrationTest`, `TriggerEventStepLeakageReproIntegrationTest`, `TriggerEventStepNoDocumentProcessingIntegrationTest`, `EmbeddedRoutingBridgeIntegrationTest`, `workflow/WorkflowStepRunnerTest` | DONE |
| Steps + expressions + quickjs | `src/registry/processors/steps/__tests__/*`, `src/util/expression/__tests__/*` | `SequentialWorkflowProcessorTest`, `UpdateDocumentStepExecutorIntegrationParityTest`, `UpdateDocumentStepExecutorDirectParityTest`, `TriggerEventStepExecutorIntegrationParityTest`, `TriggerEventStepExecutorDirectParityTest`, `JavaScriptCodeStepExecutorIntegrationParityTest`, `JavaScriptCodeStepExecutorDirectParityTest`, `QuickJsSidecarRuntimeTest`, `QuickJSEvaluatorTest`, `QuickJSEvaluatorGasTest`, `QuickJsFuelCalibrationTest`, `QuickJsExpressionUtilsTest`, `QuickJsConfigTest`, `CodeBlockEvaluationErrorTest` | DONE |
| Integration parity | `src/__tests__/integration/**/*` | `DynamicWorkflowRegistrationIntegrationTest`, `TriggerEventStepLeakageReproIntegrationTest`, `TriggerEventStepNoDocumentProcessingIntegrationTest`, `DeepEmbeddedPropagationIntegrationTest`, `CrossTriggeringIntegrationTest`, `ProcessMultiPathsIntegrationTest`, `ProcessProtectedPathRemovalTerminatesRootIntegrationTest`, `SharedTimelineCheckpointIntegrationTest`, `EmbeddedRoutingBridgeIntegrationTest` | DONE |
| Golden parity fixtures | fixture/golden strategy in plan | `parity-fixtures/*`, `ParityFixturesTest` | DONE |

---

## Next updates

This checklist is updated after each parity feature group lands, with status transitions and Java test links.
Current in-flight work:
- Test-migration status: constants/pointers, API facade, runtime core, engine core, contract-model schemas, merge behavior, and integration suites are now marked `DONE` in coverage mapping based on direct Java parity tests.
- JS integration directory parity migration is complete with direct Java integration tests for every `src/__tests__/integration/**/*` scenario in the pinned target commit.
- Merge parity baseline is complete: `ExpressionPreserver` is wired into the default merge pipeline before type assignment, and Java tests cover expression preservation plus regular-value passthrough behavior.
- Expression utility parity now covers the migrated QuickJS traversal/pattern surface end-to-end, including delimiter-aware brace expansion (with escaped literals), extglob variants (`@`, `?`, `+`, `*`, `!`) with escaped delimiters, POSIX and escaped character classes, `dot` hidden-segment controls, `nocase`/`noglobstar` options, stepped numeric/alphabetic brace ranges, and gas-callback propagation during traversal (`QuickJsExpressionUtilsTest`).
- Registry/type-chain lookup now supports inline derived type-chain fallback and provider-backed repository type-chain fallback during node→class resolution (workflow, operation handler, and operation marker contracts), including fallback to contract-node `blueId` / `properties.blueId` / scalar-string BlueId values when `type` is absent, and workflow event/type matching now also supports provider-backed semantic subtype fallback for explicit `blueId` filter nodes (including candidate `properties.blueId` fields).
- Workflow type-requirement matching now also covers provider-backed semantic subtype chains for both dictionary `entries` and list `itemType` requirements when repository definitions expose ancestry via either `properties.blueId` or scalar-string node values, including both candidate and requirement contract nodes whose `type` metadata is expressed via `type.properties.blueId` or scalar `type.value` (`WorkflowContractSupportTest`), and operation-request matching now exercises the same provider-definition forms end-to-end in sequential workflow operation filtering (`SequentialWorkflowProcessorTest#sequentialWorkflowOperationMatchesProviderDefinitionPropertyAndScalarTypeChainsInRequestSchema`), reducing subtype-chain gaps in request filtering.
- Contract processor lookup now also supports node-driven `type`-chain resolution for handler/channel/marker processor matches, including provider-backed derived BlueIds (handler + marker), resolved-class hierarchy fallback for derived contract BlueIds, and derived timeline channel types (`ContractProcessorRegistryTest#lookupByNodeTypeChainSupportsDerivedBlueIds`, `#lookupByNodeTypeChainSupportsProviderDerivedBlueIds`, `#lookupMarkerByNodeSupportsProviderDerivedMarkerTypes`, `#lookupByNodeFallsBackToResolvedClassHierarchyWhenTypeChainMissing`, `#lookupChannelByNodeUsesResolvedModelClassForTimelineSubtype`, `#lookupChannelByNodeSupportsProviderDerivedTimelineTypes`), reducing class-only lookup gaps.
- Contract processor lookup now also supports node-driven contract-level BlueId fallbacks (direct and provider-derived) when `type` chains are absent, across both explicit `properties.blueId` and scalar-string node forms (`ContractProcessorRegistryTest#lookupByNodeBlueIdFieldSupportsDirectAndProviderDerivedLookups`), further reducing class-only lookup gaps.
- Contract processor lookup by BlueId string now also supports provider-derived type-chain fallback for handler/channel/marker registries, including provider definitions that expose ancestor BlueIds via `properties.blueId` or scalar-string node values (`ContractProcessorRegistryTest#lookupByBlueIdStringSupportsProviderDerivedLookups`, `#lookupByBlueIdStringSupportsProviderDefinitionsWithPropertyAndScalarBlueIds`), reducing direct-id-only gaps.
- Contract processor lookup by node type-chain now also supports provider definitions that expose ancestor BlueIds via `properties.blueId` or scalar-string node values (`ContractProcessorRegistryTest#lookupByNodeTypeChainSupportsProviderDefinitionsWithPropertyAndScalarBlueIds`), improving provider-chain parity when fetched definitions omit `type.blueId`.
- Default registry bootstrap parity now explicitly verifies all operation-marker aliases (`Conversation/Operation`, `Operation`, `Conversation/Change Operation`, `ChangeOperation`) are registered by defaults (`ContractProcessorRegistryBuilderDefaultsTest`).
- QuickJS sidecar failures now preserve structured error names/messages plus runtime stack payloads (with stack availability marker), with runtime exception accessors for downstream error-model parity (`ScriptRuntimeException#errorName/#runtimeMessage/#stackAvailable/#runtimeStack`) and direct migration coverage (`QuickJsSidecarRuntimeTest`, including syntax/runtime/out-of-gas error classes); wrapped evaluator failures now surface the same metadata via `CodeBlockEvaluationError` accessors (`runtimeErrorName`, `runtimeErrorMessage`, `runtimeStackAvailable`, `runtimeStack`) with direct coverage in `QuickJSEvaluatorTest` and `CodeBlockEvaluationErrorTest`, while evaluator continues to enforce supported binding-key validation plus host-handler binding shape validation for `document`/`emit` and out-of-gas timeout classification for tiny wasm budgets (`QuickJSEvaluatorGasTest`). Sidecar now reports runtime fuel directly from quickjs runtime (`gasUsed`/`gasRemaining`) with deterministic stability assertions in `QuickJsSidecarRuntimeTest` and `QuickJsFuelCalibrationTest`.
- `QuickJSEvaluator` canonical helper parity now includes deep/shallow `canon.unwrap(...)` behavior for wrapped canonical objects/arrays (`value`/`items`) with direct migration assertions in `QuickJSEvaluatorTest#canonUnwrapSupportsDeepAndShallowModes`.
- QuickJS evaluator row in section 3 is now tracked as `DONE` based on direct parity coverage across sync evaluation, binding defaults, host callback validation, canonical helpers, structured error metadata propagation, null-vs-undefined handling, and deterministic global masking (`QuickJSEvaluatorTest`, `QuickJSEvaluatorGasTest`).
- JavaScript step parity now also verifies deep/shallow `canon.unwrap(...)` usage through workflow execution bindings (`SequentialWorkflowProcessorTest#javaScriptCodeStepCanonUnwrapSupportsDeepAndShallowModes`).
- JavaScript step parity coverage now also includes:
  - special document segment reads for `name`/`description`/`value`/`blueId` via both plain and canonical document helpers
  - previous-step result access from `steps.<name>.*`
  - explicit `null` step-result propagation across JS steps while preserving skip semantics for `undefined` returns
  - deterministic rejection of async/await and runaway-loop fatal termination behavior in workflow processing
  (`SequentialWorkflowProcessorTest`).
- JavaScript Code step row in section 3 is now tracked as `DONE` based on direct and integration parity suites (`JavaScriptCodeStepExecutorDirectParityTest`, `JavaScriptCodeStepExecutorIntegrationParityTest`, `SequentialWorkflowProcessorTest`).
- Update/Trigger step parity coverage now also includes:
  - template-path and expression-array `changeset` evaluation in Update Document steps
  - unsupported Update Document operation fatal termination behavior
  - Trigger Event payload emission assertions and missing-payload fatal termination behavior
  (`SequentialWorkflowProcessorTest` additions aligned with JS step-executor test scenarios).
- Update Document step integration parity now has dedicated lifecycle-init migration coverage for:
  - initialization-time document mutation
  - `document(...)` + previous-step result arithmetic
  - expression-generated multi-patch changesets
  - applying changesets produced by JavaScript step outputs
  (`UpdateDocumentStepExecutorIntegrationParityTest`).
- Update Document direct step parity now includes:
  - real context execution for expression-resolved value changes
  - static ADD/REMOVE patch operation execution paths
  - expression-returned `changeset` array execution
  - path-expression evaluation failure surfacing as `CodeBlockEvaluationError`
  - fatal validation for non-string/empty patch paths
  - provider-backed derived step-type acceptance in direct execution (including provider definitions exposing parent step type via `type.blueId`, root `properties.blueId`, or scalar-string `value`)
  - base gas charging side-effect assertions
  - direct fatal error path for unsupported patch operations
  - direct fatal error path for invalid step schema/type payloads
  (`UpdateDocumentStepExecutorDirectParityTest`).
- Trigger Event step integration parity now has dedicated lifecycle-init migration coverage for:
  - initialization-time payload emission
  - routed delivery to Triggered Event Channel consumers
  - expression resolution in emitted payloads
  - `currentContract` binding visibility in Trigger Event expressions
  (`TriggerEventStepExecutorIntegrationParityTest`).
- Trigger Event direct step parity now includes:
  - real context emission path with expression-resolved payload values
  - trigger-base gas charging side-effect assertions
  - nested embedded-document expression preservation in emitted payloads
  - provider-backed derived step-type acceptance in direct execution (including provider definitions exposing parent step type via `type.blueId`, root `properties.blueId`, or scalar-string `value`)
  - direct fatal error path for missing event payloads
  - direct fatal error path for invalid step schema/type payloads
  (`TriggerEventStepExecutorDirectParityTest`).
- JavaScript Code step integration parity now has dedicated lifecycle-init migration coverage for:
  - emitted payload composition across multiple JS steps
  - fatal termination wrapping for thrown JS errors
  - JS-emitted event delivery through Triggered Event Channel consumers
  (`JavaScriptCodeStepExecutorIntegrationParityTest`).
- JavaScript Code step direct parity now includes runtime-context execution coverage for:
  - direct executor invocation with real processor context
  - document/event binding evaluation (`document('/counter') + event.x`)
  - fatal validation for missing `code` payload
  - direct wrapped script-error metadata via `CodeBlockEvaluationError`
  - direct out-of-gas error surfacing for runaway code
  - deterministic `Date`/`process` masking in direct execution path
  - provider-backed derived step-type acceptance in direct execution (including provider definitions exposing parent step type via `type.blueId`, root `properties.blueId`, or scalar-string `value`)
  - direct fatal error path for invalid step schema/type payloads
  - wasm gas charging side effect on processor runtime totals
  (`JavaScriptCodeStepExecutorDirectParityTest`).
- `JavaScriptCodeStepExecutor` now normalizes emitted event `type` payloads into semantic node-type metadata to preserve Triggered Event Channel routing parity for JS object emissions.
- Sequential Workflow handler integration parity now has dedicated migration coverage for:
  - timeline-triggered Trigger Event emissions
  - workflow-level event filters
  - channel-only matching when workflow filter is omitted
  - combined channel+workflow filter enforcement
  (`SequentialWorkflowHandlerProcessorIntegrationParityTest`).
- Composite timeline parity coverage now includes:
  - missing-child failure behavior
  - no-match fast path
  - multi-child declared-order deliveries
  - per-child checkpoint recency decisions
  - nested composite recency behavior
  - workflow JS access to `event.meta.compositeSourceChannelKey`
  (`CompositeTimelineChannelProcessorTest`, `CompositeTimelineChannelIntegrationParityTest`).
- MyOS timeline channel parity coverage now explicitly verifies:
  - matching for both MyOS and conversation timeline-entry event shapes
  - rejection of non-timeline or mismatched timeline-id events (including arbitrary event types carrying matching `timelineId`)
  - recency comparison behavior against prior checkpointed events
  - document-processing integration behavior for MyOS vs conversation timeline entries and mismatch guards
  (`MyOSTimelineChannelProcessorTest`, `MyOSTimelineChannelIntegrationParityTest`).
- Timeline channel parity now includes:
  - non-timeline and mismatched timeline-id rejection
  - handler delivery + checkpointed event metadata assertions
  - duplicate event-id checkpoint gating
  - channel-level event-filter matching semantics
  - strict conversation timeline-entry type gating (arbitrary events with `timelineId` are ignored)
  (`TimelineChannelProcessorTest`, `TimelineChannelProcessorIntegrationParityTest`).
- Timeline/composite/MyOS channel processor rows in section 2 are now tracked as `DONE` based on direct unit + integration parity coverage (`TimelineChannelProcessorTest`, `TimelineChannelProcessorIntegrationParityTest`, `CompositeTimelineChannelProcessorTest`, `CompositeTimelineChannelIntegrationParityTest`, `MyOSTimelineChannelProcessorTest`, `MyOSTimelineChannelIntegrationParityTest`), and operation marker processor row is tracked `DONE` with marker-type/alias/default-registration parity coverage (`SequentialWorkflowProcessorTest`, `ContractProcessorRegistryBuilderDefaultsTest`, `ParityFixturesTest`).
- `QuickJSEvaluator` now mirrors JS binding-default semantics for missing inputs (`event`, `eventCanonical`, `steps`, `currentContract`, `currentContractCanonical`) with direct migration tests for default/null behavior and canonical fallbacks (`QuickJSEvaluatorTest`).
- `QuickJSEvaluator` now supports host `emit` callback parity in direct evaluator usage by forwarding emitted events to a supplied Java callback and returning plain evaluation values (`QuickJSEvaluatorTest#forwardsEmitCallsToHostBindingAndReturnsPlainResult`), while retaining envelope behavior when no callback is supplied (workflow-step path).
- `QuickJSEvaluator` now mirrors JS runtime code wrapping semantics by evaluating scripts as function bodies (`return` required for defined results), and migrated parity fixtures/tests now use explicit `return (...)` object literals where results are expected (`QuickJSEvaluatorTest`, `QuickJSEvaluatorGasTest`, `SequentialWorkflowProcessorTest`, `ParityFixturesTest`).
- `QuickJSEvaluator` now supports direct function-backed `document` bindings (simple and canonical pointer reads for literal pointer calls) via Java callbacks, with migration coverage in `QuickJSEvaluatorTest` (`supportsFunctionDocumentBindingForPlainAndCanonicalReads`, `supportsSimpleFunctionDocumentBindingForLiteralPointers`).
- `QuickJSEvaluator` function-backed `document` bindings now also support dynamic pointer expressions when callbacks provide root snapshots at `/`, enabling runtime pointer-variable reads through preloaded snapshot traversal (`QuickJSEvaluatorTest#supportsFunctionDocumentBindingForDynamicPointerExpressionsWhenRootSnapshotAvailable`).
- `QuickJSEvaluator` document helper parity now also includes relative-pointer resolution via `__scopePath` bindings (so `document('x')` resolves against the active workflow scope), covered by `QuickJSEvaluatorTest#resolvesRelativeDocumentPointersUsingScopePathBinding`.
- `QuickJSEvaluator` direct parity coverage now also includes:
  - explicit `currentContract` / `currentContractCanonical` binding visibility assertions
  - deterministic masking of `Date` and `process` globals in evaluator-only execution paths
  (`QuickJSEvaluatorTest`).
- QuickJS fuel calibration migration now has dedicated deterministic baseline coverage (`QuickJsFuelCalibrationTest`) for representative script complexity trends and repeated-run stability.
- Contract-model schema parity now includes MyOS marker contract mappings for `MyOS/Document Anchors`, `MyOS/Document Links`, `MyOS/MyOS Participants Orchestration`, `MyOS/MyOS Session Interaction`, and `MyOS/MyOS Worker Agency` (`ContractModelsParityTest`, `TypeClassResolverAliasTest`).
- Contract-loader parity now includes unsupported-contract MustUnderstand behavior with unsupported BlueId reason assertions, built-in contract loading coverage (including BlueId-filter channel lookup assertions for built-ins), provider-derived handler loading via type-chain lookup, explicit custom-handler loading via registered processor contract type (`Custom.Handler`), and custom-handler missing-channel fatal validation (`ContractLoaderParityTest`) in addition to composite-cycle/missing-child/nested-acyclic loader tests with reason assertions (`ContractLoaderCompositeTimelineTest`) and MyOS-marker loader tests.
- API facade parity now explicitly includes unknown contract-type capability-failure behavior (`DocumentProcessorApiParityTest#returnsCapabilityFailureForUnknownContractTypeBlueId`) with unsupported-type reason assertion, zero-gas result, and unchanged document snapshot, plus successful initialize/process capability flags and no-emission assertions for basic external-event processing (`#initializesAndProcessesDocumentThroughApiSurface`).
- Contract-bundle/runtime parity now includes JS-equivalent bundle ordering/filtering/embedded-marker/checkpoint tests (`ContractBundleParityTest`) with reserved-key/duplicate-checkpoint reason assertions (builder + post-build registration), plus direct patch-engine parity coverage (`PatchEngineParityTest`).
- Runtime parity coverage now includes JS-equivalent emission-registry scope-context reuse/missing-scope lookup plus ordering/scope-clear semantics (`EmissionRegistryTest`) and gas-meter scenario parity for initialization/scope depth, patch-size charging, and emit+cascade charging (`GasMeterParityTest`).
- Trigger Event integration parity now also includes the direct no-nested-processing scenario from JS integration tests (`TriggerEventIntegrationTest#triggerEventNestedDocumentPayloadIsNotProcessedAsDocument`).
- Processor execution-context parity now includes active/inactive patch behavior, allow-terminated patch flow, gas consumption, root emission recording, termination delegation, and JS-style pointer-read guard semantics where `documentAt`/`documentContains` return null/false for null-empty or malformed pointers instead of throwing (`ProcessorExecutionContextTest`).
- Dynamic contract registration parity now also has direct Java integration coverage for deferred workflow activation across processing cycles (`DynamicWorkflowRegistrationIntegrationTest`).
- Golden fixtures now cover sequential workflow happy path, operation mismatch scenarios (operation key mismatch, timeline-envelope message-type mismatch, and pinned document mismatch for both timeline-envelope and direct request shapes, plus operation-vs-handler channel conflict), direct/complex operation requests (including omitted `allowNewerVersion` default-pass behavior for both timeline-envelope and direct request shapes), handler event filters (including direct request shape coverage), derived change workflows, dynamic workflow deferred activation across multi-event runs, derived workflow/operation/operation-marker type-chain fallback (including provider-backed operation-marker chains), operation-marker type preservation, JS emit callback/deterministic globals/document blueId/canonical reads/document.get aliases/eventCanonical helper behavior, Trigger Event nested-document non-processing + snapshot-expression preservation, Process Embedded protected-path removal fatal termination, Process Embedded multi-path independence/removal/fatal-write scenarios (including child-B fatal write), embedded routing bridge propagation, shared-timeline duplicate checkpoint skipping plus multi-counter processing and replay-after-checkpoint-reset flows, deep embedded document-update propagation for both initialization and external-event triggers, embedded cross-triggering via document update channels, timeline non-entry rejection for strict timeline-entry gating, MyOS timeline, composite timeline, and expected initialization failures/cycle validation.
- Trigger Event leakage parity from lifecycle initialization path is now also covered by fixtures for both literal and snapshot-sourced payloads (`trigger-event-init-nested-document-expression-preserved.yaml`, `trigger-event-init-snapshot-expression-preserved.yaml`) with any-triggered-event path assertions.
- Shared-timeline checkpoint integration parity now additionally includes direct Java migration tests for checkpoint clearing/replay behavior at root scope and child-only checkpoint resets on shared timelines (`SharedTimelineCheckpointIntegrationTest`).
- Trigger Event integration parity now includes direct Java migration tests that verify nested payload documents are not processed and nested expressions remain preserved for literal and snapshot-sourced payloads (`TriggerEventIntegrationTest`).
- Trigger Event leakage repro integration parity (`contracts/trigger-event-step-leakage-repro.test.ts`) now has direct Java migration coverage (`TriggerEventStepLeakageReproIntegrationTest`) for both literal nested payload documents and snapshot-sourced payloads during initialization workflows.
- Trigger Event no-document-processing integration parity (`contracts/trigger-event-step-no-document-processing.test.ts`) now has direct Java migration coverage in `TriggerEventStepNoDocumentProcessingIntegrationTest`, validating that nested payload contracts are not recursively executed.
- Embedded routing bridge integration parity (`timeline/embedded-routing-bridge.test.ts`) now has direct Java migration coverage in `EmbeddedRoutingBridgeIntegrationTest`, including embedded timeline routing, root bridge channel handling, and emitted event assertions.
- Deep embedded propagation integration parity (`doc-update/deep-embedded-propagation.test.ts`) now has direct Java migration coverage in `DeepEmbeddedPropagationIntegrationTest`, including initialization lifecycle emission assertions and full root→branch→sub→leaf propagation checks.
- Embedded cross-triggering integration parity (`embedded/cross-triggering.test.ts`) now has direct Java migration coverage in `CrossTriggeringIntegrationTest`, including sequential sub-a/nested-b timeline event runs, nested update propagation, and root/embedded termination-marker non-presence checks.
- Embedded multi-path integration parity (`embedded/process.multi-paths.test.ts`) now has direct Java migration coverage in `ProcessMultiPathsIntegrationTest`, including independent child timeline processing, root fatal termination on protected subtree writes, and safe embedded-child root removal behavior.
- Protected embedded-path removal integration parity (`embedded/process.protected-path-removal-terminates-root.test.ts`) now has direct Java migration coverage in `ProcessProtectedPathRemovalTerminatesRootIntegrationTest`, asserting root fatal termination marker semantics and protected child non-mutation after removal attempt.
- Termination service parity now has direct Java migration coverage in `TerminationServiceParityTest`, including scope marker persistence/gas charging plus both root-fatal and root-graceful run-termination lifecycle emission semantics.
- Scope executor parity now has direct Java migration coverage in `ScopeExecutorDerivedChannelParityTest`, including derived lifecycle-channel handler execution, derived document-update routing through initialization patch cascades, and external-event dispatch skipping for derived processor-managed channels.
- Channel-runner parity now includes first-delivery handler execution + checkpoint persistence semantics (`ChannelRunnerTest#runsHandlersInOrderAndPersistsCheckpointOnFirstDelivery`), inactive-scope external-event no-op behavior (`#doesNotProcessExternalEventsWhenScopeIsInactive`), inactive-scope handler gating semantics from JS (`allowTerminatedWork`) plus mid-loop stop behavior when a handler terminates scope (`ChannelRunnerTest#stopsProcessingHandlersWhenScopeBecomesInactiveMidRun`), non-match fast-path no-op behavior, handler-level `matches(...)` gating, duplicate-signature short-circuit across multi-handler channels (`#duplicateSignaturesSkipAllHandlersAcrossMultiHandlerChannels`), fatal runtime-handler termination behavior (with checkpoint non-persistence for the failing delivery), channelized-delivery parity where handlers receive normalized channel events while caller-owned external event nodes remain unmutated and checkpoints persist/signature external payloads as immutable snapshots (`ChannelRunnerTest#deliversChannelizedEventToHandlersAndCheckpoint`, `#usesOriginalPayloadForCheckpointSignatureWhenChannelizedEventDiffers`), and composite-channel child-delivery recency/checkpoint-key behavior (`#deliversCompositeChannelPerChildAndHonorsChildRecencyCheckpoints`), covered in `ChannelRunnerTest#allowsHandlersToRunWhenScopeInactiveOnlyIfAllowTerminatedWorkIsTrue`, `#doesNothingWhenExternalChannelDoesNotMatch`, `#skipsHandlersWhoseMatchesPredicateReturnsFalse`, and `#entersFatalTerminationWhenHandlerThrowsRuntimeException`.
- Checkpoint-manager parity now includes JS-equivalent duplicate-signature detection, signature fallback derivation from stored last-event payload when explicit last-signature is absent, null-record persistence no-op behavior, and persist-time checkpoint marker map updates with cloned event snapshot storage (`CheckpointManagerTest#persistUpdatesCheckpointAndChargesGas`, `#findsCheckpointRecordsAndDerivesExistingSignatureWhenMissingExplicitSignature`, `#detectsDuplicateEventsViaSignatures`, `#ignoresPersistenceWhenRecordIsNull`).
- Scope executor parity now also includes direct core-flow coverage in `ScopeExecutorParityTest` for initialization marker/lifecycle emission, unmanaged external-event routing, and boundary-violation fatal termination behavior.
- ExpressionPreserver merge parity now includes the non-expression passthrough scenario from JS (`doesNotAlterRegularValuesWithoutExpressions`), confirming regular typed values are left intact while expression preservation remains active.
- QuickJS expression helper parity now aligns standalone/template detection with JS multiline/nested-brace semantics (`isExpression`/`containsExpression`) and traversal semantics by honoring `shouldDescend` on the current pointer with root-pointer `"/"` defaults before evaluating node values (`QuickJsExpressionUtilsTest` regression coverage).
- `evaluateQuickJsExpression(...)` now wraps expressions as `return (<expr>);` before runtime evaluation (JS parity), so object-literal expressions evaluate as objects rather than statement blocks (`QuickJsExpressionUtilsTest` coverage).
- QuickJS expression traversal parity now explicitly verifies wasm-gas callback charging from evaluator-reported `wasmGasUsed` values during expression resolution (`QuickJsExpressionUtilsTest#resolveExpressionsChargesWasmGasFromEvaluatorUsage`).
- QuickJS path-predicate parity now hardens `dot=false` globstar behavior for hidden path segments while still allowing explicit hidden-segment patterns such as character-class dot matches (`/[.]hidden`, `/**/[.]hidden`) in `QuickJsExpressionUtilsTest`.
- QuickJS path-predicate parity now also covers basic brace-range expansion semantics (`{1..3}`, `{c..a}`) while preserving picomatch-like non-expansion of zero-padded numeric ranges (`{01..03}`), with direct `QuickJsExpressionUtilsTest` coverage.
- QuickJS path-predicate parity now also covers brace-range step expansions (`{1..7..3}`, `{7..1..3}`, `{a..g..2}`, `{g..a..2}`, `{-3..3..3}`), treats negative step declarations as absolute magnitudes (`{1..7..-2}`), and rejects invalid zero-step ranges (`{1..3..0}`), with direct `QuickJsExpressionUtilsTest` coverage.
- Script/evaluator parity now preserves explicit `null` vs `undefined` result distinction from sidecar protocol (`resultDefined`), enabling workflow-step parity where only `undefined` skips step-result registration (`QuickJsSidecarRuntimeTest`, `QuickJSEvaluatorTest`, `WorkflowStepRunnerTest`, `JavaScriptCodeStepExecutorDirectParityTest`, `SequentialWorkflowProcessorTest`).
- Sidecar protocol parity now also preserves `resultDefined=false` for emit-only undefined evaluations (not just plain expressions), keeping direct evaluator callback mode aligned with JS null-vs-undefined step-result semantics.
- Deep embedded initialization parity now includes direct Java migration coverage ensuring initialization lifecycle events can drive nested document-update watchers across embedded scope boundaries (`DeepEmbeddedInitializationPropagationTest`).
- Sequential workflow operation parity now includes derived-channel `currentContract.channel` binding coverage when handler channel is inferred from the operation marker (`SequentialWorkflowProcessorTest#sequentialWorkflowOperationExposesDerivedChannelInCurrentContractBindings`).
- Sequential workflow operation matcher parity now supports provider-backed semantic subtype chains (beyond inline `type.type...` nodes) for request payload typing, operation-definition typing, and operation-marker channel derivation, including provider definitions surfaced via `type.blueId`, `properties.blueId`, and scalar-string value forms (`SequentialWorkflowOperationProviderTypeChainIntegrationParityTest`, `WorkflowContractSupportTest`).
- Workflow matcher parity now also resolves provider-backed subtype chains for explicit `blueId` filter-property matching (including candidate-side `properties.blueId` values), and now accepts provider definitions surfaced via `type.blueId`, root `blueId`, `properties.blueId`, or scalar-string node value forms (`WorkflowContractSupportTest#matchesEventFilterResolvesProviderBackedBlueIdPropertyChains`, `#matchesEventFilterSupportsCandidatePropertyBlueIdField`, `#matchesEventFilterResolvesProviderDefinitionPropertyBlueIdChains`, `#matchesEventFilterResolvesProviderDefinitionScalarBlueIdChains`).
- Sequential workflow operation pinning parity now falls back to semantic BlueId calculation when `contracts.initialized.documentId` is absent, matching JS matcher semantics rather than hard-failing the request (`SequentialWorkflowProcessorTest#sequentialWorkflowOperationFallsBackToComputedDocumentIdWhenMarkerIdMissing`).
- Sequential workflow operation request parity now also verifies default `allowNewerVersion=true` semantics when the flag is omitted from the operation request payload for both timeline-envelope and direct request event shapes (`SequentialWorkflowProcessorTest#sequentialWorkflowOperationDefaultsAllowNewerVersionWhenFlagMissing`, `#sequentialWorkflowOperationDirectRequestDefaultsAllowNewerWhenFlagMissing`).
- Sequential workflow operation request parity now also verifies pinned-document mismatch gating for direct request event shape (`SequentialWorkflowProcessorTest#sequentialWorkflowOperationDirectRequestSkipsWhenPinnedDocumentDiffers`), matching timeline-envelope pinning behavior.
- Sequential workflow operation request parity now also verifies handler-level event-filter matching against direct request event shape (`SequentialWorkflowProcessorTest#sequentialWorkflowOperationDirectRequestHonorsHandlerEventFilters`).
- Sequential workflow operation request parity now also verifies operation-key mismatch gating against direct request event shape (`SequentialWorkflowProcessorTest#sequentialWorkflowOperationDirectRequestSkipsWhenOperationKeyDiffers`), matching timeline-envelope operation-key mismatch behavior.
- Sequential workflow operation matcher parity now requires timeline-envelope `message` payloads to be semantically typed as operation requests before matching (`Conversation/Operation Request`, `Operation Request`, and provider-derived aliases), preventing non-operation timeline messages (or missing message types) that happen to include `operation`/`request` keys from triggering handlers while still allowing provider-derived and scalar-declared operation-request message types; timeline-entry alias envelopes (`TimelineEntry`) and non-timeline envelopes with lookalike `message.operation/request` payloads are also explicitly covered (accept alias envelope, ignore non-timeline) to preserve JS timeline-envelope gating semantics (`SequentialWorkflowProcessorTest#sequentialWorkflowOperationSkipsWhenTimelineMessageTypeIsNotOperationRequest`, `#sequentialWorkflowOperationSkipsWhenTimelineMessageTypeIsMissing`, `#sequentialWorkflowOperationAcceptsProviderDerivedTimelineMessageOperationRequestType`, `#sequentialWorkflowOperationAcceptsTimelineMessageTypeDeclaredAsScalarValue`, `#sequentialWorkflowOperationAcceptsTimelineMessageTypeAlias`, `#sequentialWorkflowOperationAcceptsTimelineEntryAliasEnvelope`, `#sequentialWorkflowOperationSkipsNonTimelineEventsEvenWhenMessageLooksLikeOperationRequest`, fixtures `operation-timeline-message-type-mismatch.yaml`, `operation-timeline-message-type-missing.yaml`, `operation-timeline-message-type-scalar.yaml`, `operation-timeline-message-type-alias.yaml`, `operation-timeline-entry-alias-envelope.yaml`, `operation-non-timeline-envelope-message-ignored.yaml`, `provider-derived-operation-message-type-blueid-property-entry-chain.yaml`, `provider-derived-operation-message-type-blueid-value-chain.yaml`).
- Based on migrated JS operation-processor scenarios plus additional timeline-envelope typing regressions, operation-matcher helper parity is now tracked as `DONE` for the pinned target commit.
- Workflow-level event-filter matching now also supports provider-backed semantic subtype chains for both sequential workflow handlers and sequential workflow operations (timeline-envelope and direct-request event shapes), including provider definitions surfaced via `type.blueId`, `properties.blueId`, and scalar-string value forms, covered by `WorkflowEventFilterProviderTypeChainIntegrationParityTest`.
- Workflow step runner parity now resolves executors via derived step-type chains (inline and provider-backed) rather than direct `type.blueId` only, including provider definitions that expose ancestor step BlueIds via scalar node values or `properties.blueId` when `type.blueId` is absent, covered by `WorkflowStepRunnerTest`, `WorkflowStepRunnerProviderChainParityTest`, and provider-derived step fixtures.
- Workflow step runner parity now also forwards bound contract-node metadata into step execution args and QuickJS bindings (`currentContract`/`currentContractCanonical`) instead of relying only on workflow-key document lookups, with regression coverage in `WorkflowStepRunnerTest` and `JavaScriptCodeStepExecutorDirectParityTest`.
- Workflow step runner unsupported-step fatal paths now prefer `step.type.name` when available (matching JS error messaging behavior rather than always reporting raw `blueId`), covered by `SequentialWorkflowProcessorTest`.
- Golden fixture coverage now also includes provider-backed operation-request subtype-chain matching for both timeline-envelope and direct request event shapes (`provider-derived-operation-request-type-chain.yaml`, `provider-derived-direct-operation-request-type-chain.yaml`), plus provider definitions that surface ancestor BlueIds via scalar node values and `providerNodes.propertyBlueId` entries across both event shapes (`provider-derived-operation-request-blueid-value-chain.yaml`, `provider-derived-operation-request-blueid-property-entry-chain.yaml`, `provider-derived-direct-operation-request-blueid-value-chain.yaml`, `provider-derived-direct-operation-request-blueid-property-entry-chain.yaml`), to lock parity in the fixture harness path (`ParityFixturesTest`).
- Golden fixture coverage now also includes provider-backed operation-definition subtype-chain matching for both timeline-envelope and direct request event shapes (`provider-derived-operation-definition-type-chain.yaml`, `provider-derived-direct-operation-definition-type-chain.yaml`), plus provider definitions surfaced via scalar value ancestry and `providerNodes.propertyBlueId` entries (`provider-derived-operation-definition-blueid-value-chain.yaml`, `provider-derived-operation-definition-blueid-property-entry-chain.yaml`, `provider-derived-direct-operation-definition-blueid-value-chain.yaml`, `provider-derived-direct-operation-definition-blueid-property-entry-chain.yaml`), to lock provider-derived operation-type parity in the fixture harness path (`ParityFixturesTest`).
- Golden fixture coverage now also includes provider-backed operation-marker subtype-chain matching for both timeline-envelope and direct request event shapes (`provider-derived-operation-marker-type-chain.yaml`, `provider-derived-direct-operation-marker-type-chain.yaml`), plus provider definitions surfaced via scalar value ancestry and `providerNodes.propertyBlueId` entries (`provider-derived-operation-marker-blueid-value-chain.yaml`, `provider-derived-operation-marker-blueid-property-entry-chain.yaml`, `provider-derived-direct-operation-marker-blueid-value-chain.yaml`, `provider-derived-direct-operation-marker-blueid-property-entry-chain.yaml`), to lock provider-derived operation-marker parity in the fixture harness path (`ParityFixturesTest`).
- Golden fixture coverage now also includes provider-backed workflow event-filter subtype matching for both timeline-envelope and direct request event shapes (`provider-derived-workflow-event-filter-type-chain.yaml`, `provider-derived-direct-workflow-event-filter-type-chain.yaml`), plus provider-definition fallback where derived BlueIds are surfaced via scalar value ancestry and property entries rather than `type.blueId` (`provider-derived-workflow-event-filter-blueid-value-chain.yaml`, `provider-derived-workflow-event-filter-blueid-property-entry-chain.yaml`, `provider-derived-direct-workflow-event-filter-blueid-value-chain.yaml`, `provider-derived-direct-workflow-event-filter-blueid-property-entry-chain.yaml`, `provider-derived-direct-workflow-event-filter-blueid-property-chain.yaml`), to lock provider-chain filtering parity in the fixture harness path (`ParityFixturesTest`).
- Golden fixture coverage now also includes provider-backed operation-workflow event-filter subtype matching for both timeline-envelope and direct request event shapes (`provider-derived-operation-event-filter-type-chain.yaml`, `provider-derived-direct-operation-event-filter-type-chain.yaml`), plus provider-definition fallback where derived BlueIds are surfaced via scalar value ancestry and `providerNodes.propertyBlueId` entries (`provider-derived-operation-event-filter-blueid-value-chain.yaml`, `provider-derived-operation-event-filter-blueid-property-entry-chain.yaml`, `provider-derived-direct-operation-event-filter-blueid-value-chain.yaml`, `provider-derived-direct-operation-event-filter-blueid-property-entry-chain.yaml`), to lock provider-chain filtering parity for sequential workflow operations in the fixture harness path (`ParityFixturesTest`).
- Golden fixture harness now supports optional gas assertions (`totalGas`, `totalGasMin`, `totalGasMax`) and uses them in migrated fixtures (e.g. `sequential-workflow-happy.yaml`) to validate runtime accounting in addition to document/event outcomes.
- Golden fixtures now also cover initialization-time capability-failure parity for missing contract processors, including failure-reason and zero-gas assertions (`initialization-capability-failure-missing-processor.yaml`).
- Golden fixtures now also cover provider-derived workflow step-type chains for Update Document / Trigger Event / JavaScript Code (`provider-derived-update-step-type-chain.yaml`, `provider-derived-trigger-step-type-chain.yaml`, `provider-derived-javascript-step-type-chain.yaml`), plus provider-definition fallback via scalar value ancestry and explicit `providerNodes.propertyBlueId` fixture entries across all three step families (`provider-derived-update-step-blueid-value-chain.yaml`, `provider-derived-trigger-step-blueid-value-chain.yaml`, `provider-derived-javascript-step-blueid-value-chain.yaml`, `provider-derived-update-step-blueid-property-entry-chain.yaml`, `provider-derived-trigger-step-blueid-property-entry-chain.yaml`, `provider-derived-javascript-step-blueid-property-entry-chain.yaml`).
