# BlueId calculation callsites inventory

This inventory tracks current BlueId calculation usage across the monorepo.
It is the Phase 0 source of truth for identity callsites and migration impact.

## Inventory method

Repo-wide scan command used:

```bash
rg "BlueIdCalculator\.|calculateBlueIdSync\(|calculateBlueId\(" libs --glob "*.ts"
```

The list below includes **every matching file** and is grouped by package and
intent (production vs test/support).

## `libs/language`

### Production files

- `libs/language/src/lib/Blue.ts`
- `libs/language/src/lib/merge/Merger.ts`
- `libs/language/src/lib/mapping/ComplexObjectConverter.ts`
- `libs/language/src/lib/model/ResolvedNode.ts`
- `libs/language/src/lib/provider/BaseContentNodeProvider.ts`
- `libs/language/src/lib/provider/BasicNodeProvider.ts`
- `libs/language/src/lib/provider/InMemoryNodeProvider.ts`
- `libs/language/src/lib/provider/NodeContentHandler.ts`
- `libs/language/src/lib/provider/RepositoryBasedNodeProvider.ts`
- `libs/language/src/lib/utils/BlueIdCalculator.ts`
- `libs/language/src/lib/utils/MergeReverser.ts`
- `libs/language/src/lib/utils/NodeTypes.ts`
- `libs/language/src/lib/utils/TypeSchemaResolver.ts`
- `libs/language/src/utils/blueId/calculateBlueId.ts`
- `libs/language/src/utils/blueObject/enrichWithBlueId.ts`

### Tests / fixtures / support files

- `libs/language/src/lib/__tests__/Blue.documentLinks.test.ts`
- `libs/language/src/lib/__tests__/Blue.inlineTypes.test.ts`
- `libs/language/src/lib/__tests__/Blue.minimize.test.ts`
- `libs/language/src/lib/__tests__/repositoryVersioning/fixtures.ts`
- `libs/language/src/lib/__tests__/repositoryVersioning/repositoryRegistration.test.ts`
- `libs/language/src/lib/mapping/__tests__/NodeToObjectConverter.test.ts`
- `libs/language/src/lib/merge/__tests__/Merger.resolve.regression.test.ts`
- `libs/language/src/lib/merge/__tests__/TypeAssigner.test.ts`
- `libs/language/src/lib/model/__tests__/ResolvedNode.test.ts`
- `libs/language/src/lib/provider/__tests__/BasicNodeProvider.test.ts`
- `libs/language/src/lib/provider/__tests__/RepositoryBasedNodeProvider.test.ts`
- `libs/language/src/lib/utils/__tests__/BlueIdCalculator.test.ts`
- `libs/language/src/lib/utils/__tests__/BlueIdToCid.test.ts`
- `libs/language/src/lib/utils/__tests__/MergeReverser.test.ts`
- `libs/language/src/lib/utils/__tests__/NodeExtender.test.ts`
- `libs/language/src/lib/utils/__tests__/NodeTypeMatcher.test.ts`
- `libs/language/src/lib/utils/__tests__/RepositoryVersionSerializer.test.ts`
- `libs/language/src/lib/utils/__tests__/TypeSchema.integration.test.ts`
- `libs/language/src/utils/blueId/__tests__/calculateBlueId.test.ts`

## `libs/repository-generator`

### Production files

- `libs/repository-generator/src/lib/core/blueIds.ts`
- `libs/repository-generator/src/lib/core/repoDoc.ts`

### Tests / support files

- `libs/repository-generator/src/__tests__/generateRepository.test.ts`

## `libs/document-processor`

### Production files

- `libs/document-processor/src/engine/processor-engine.ts`
- `libs/document-processor/src/engine/processor-execution-context.ts`
- `libs/document-processor/src/registry/processors/composite-timeline-channel-processor.ts`
- `libs/document-processor/src/registry/processors/utils/operation-utils.ts`
- `libs/document-processor/src/registry/processors/workflow/operation-matcher.ts`

### Tests / support files

- `libs/document-processor/src/__tests__/DocumentProcessorInitializationTest.test.ts`
- `libs/document-processor/src/__tests__/ProcessEmbeddedTest.test.ts`
- `libs/document-processor/src/__tests__/derived-blue-types.ts`
- `libs/document-processor/src/engine/__tests__/scope-executor.test.ts`
- `libs/document-processor/src/registry/processors/steps/__tests__/javascript-code-step-executor.test.ts`
- `libs/document-processor/src/test-support/blue.ts`

## `libs/dsl-sdk`

### Tests / support files

- `libs/dsl-sdk/src/test-support/editing-support.ts`

## Notes

- This inventory is intentionally broad (production + test/support) so future
  milestone work (Phase D/B) can quickly identify identity coupling.
- Update this file whenever a new production BlueId calculation callsite is
  introduced.
