# BLUE TS DSL SDK — Stage 2 Coverage Matrix

Update this file as stage-2 implementation proceeds.

| Feature | Java reference | Mapping/parity test | Runtime test | Guardrail test | Status | Deviation? |
|---|---|---|---|---|---|---|
| `onInit(...)` | `DocBuilderGeneralDslParityTest.onInitMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts` | `doc-builder.workflows.integration.test.ts` | n/a | done | no |
| `onEvent(...)` | `DocBuilderGeneralDslParityTest.onEventMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts` | `doc-builder.workflows.integration.test.ts` | n/a | done | no |
| `onNamedEvent(...)` | `DocBuilderGeneralDslParityTest.onNamedEventMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts` | `doc-builder.workflows.integration.test.ts` | `doc-builder.steps.parity.test.ts` | done | yes |
| `onDocChange(...)` | `DocBuilderGeneralDslParityTest.onDocChangeMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts` | `doc-builder.workflows.integration.test.ts` | n/a | done | no |
| `onChannelEvent(...)` | `DocBuilderChannelsDslParityTest.onChannelEventMatchesYamlDefinition` | `doc-builder.workflows.parity.test.ts` | none | n/a | deviation | yes |
| `updateDocument(...)` | `DocBuilderStepsDslParityTest.stepPrimitivesAndEmitHelpersBuildExpectedContracts` | `doc-builder.steps.parity.test.ts` | `doc-builder.workflows.integration.test.ts` | `changeset-builder.test.ts` | done | no |
| `updateDocumentFromExpression(...)` | same | `doc-builder.steps.parity.test.ts` | `doc-builder.workflows.integration.test.ts` | n/a | done | no |
| `namedEvent(...)` | same | `doc-builder.steps.parity.test.ts` | `doc-builder.workflows.integration.test.ts` | `doc-builder.steps.parity.test.ts` | done | yes |
| `bootstrapDocument(...)` | `bootstrapDocumentBuildersMapDocumentBindingsAndOptions` | `doc-builder.steps.parity.test.ts` | `doc-builder.workflows.integration.test.ts` | n/a | done | no |
| `bootstrapDocumentExpr(...)` | same | `doc-builder.steps.parity.test.ts` | parity only | `doc-builder.steps.parity.test.ts` | done | no |
| `ext(factory)` | `extRejectsNullFactoriesAndNullExtensions`, `extSupportsCustomStepExtensions` | `doc-builder.steps.parity.test.ts` | n/a | `doc-builder.steps.parity.test.ts` | done | no |
| `ChangesetBuilder` path validation | `ChangesetBuilder.java` | `doc-builder.steps.parity.test.ts` | n/a | `changeset-builder.test.ts` | done | no |
