# BLUE TS DSL SDK — Stage 2 Coverage Matrix

Update this file as stage-2 implementation proceeds.

| Feature | Java reference | Mapping/parity test | Runtime test | Guardrail test | Status | Deviation? |
|---|---|---|---|---|---|---|
| `onInit(...)` | `DocBuilderGeneralDslParityTest.onInitMatchesYamlDefinition` | planned | planned | n/a | planned | no |
| `onEvent(...)` | `DocBuilderGeneralDslParityTest.onEventMatchesYamlDefinition` | planned | planned | n/a | planned | no |
| `onNamedEvent(...)` | `DocBuilderGeneralDslParityTest.onNamedEventMatchesYamlDefinition` | planned | planned | planned | planned | maybe |
| `onDocChange(...)` | `DocBuilderGeneralDslParityTest.onDocChangeMatchesYamlDefinition` | planned | planned | n/a | planned | no |
| `onChannelEvent(...)` | `DocBuilderChannelsDslParityTest.onChannelEventMatchesYamlDefinition` | planned | planned-if-clean | n/a | planned | maybe |
| `updateDocument(...)` | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | planned | planned | planned | planned | no |
| `updateDocumentFromExpression(...)` | same | planned | planned | n/a | planned | no |
| `namedEvent(...)` | same | planned | planned | planned | planned | maybe |
| `bootstrapDocument(...)` | `bootstrapDocumentBuildersMapDocumentBindingsAndOptions` | planned | planned | planned | planned | no |
| `bootstrapDocumentExpr(...)` | same | planned | planned | planned | planned | no |
| `ext(factory)` | `extRejectsNullFactoriesAndNullExtensions`, `extSupportsCustomStepExtensions` | planned | optional | planned | planned | no |
| `ChangesetBuilder` path validation | `ChangesetBuilder.java` | planned | n/a | planned | planned | no |
