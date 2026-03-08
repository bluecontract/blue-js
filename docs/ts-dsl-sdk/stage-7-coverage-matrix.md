# Stage 7 coverage matrix

| Area | Mapping/reference doc | Unit tests | Roundtrip tests | Runtime-backed tests | Status | Notes |
|---|---|---:|---:|---:|---|---|
| `DocStructure.from(...)` | editing-materialization-reference.md | `DocStructure.test.ts` | `EditingPipeline.test.ts` | n/a | implemented | includes unknown-contract resilience and stable ordering coverage |
| `toSummaryJson()` | editing-materialization-reference.md | `DocStructure.test.ts` | `EditingPipeline.test.ts` | n/a | implemented | deterministic summary comparison on repeated extraction and roundtrip |
| `toPromptText()` | editing-materialization-reference.md | `DocStructure.test.ts` | no | n/a | implemented | prompt stability covered directly in extraction tests |
| `DocPatch.from(...)` | editing-materialization-reference.md | `DocPatch.test.ts` | `EditingPipeline.test.ts` | n/a | implemented | uses Stage-7 editing JSON envelope |
| `DocPatch.build()/apply()` | editing-materialization-reference.md | `DocPatch.test.ts` | `EditingPipeline.test.ts` | n/a | implemented | add/replace/remove, nested objects, contract-internal diff, apply roundtrip |
| `BlueChangeCompiler` | editing-materialization-reference.md | `BlueChangeCompiler.test.ts` | `EditingPipeline.test.ts` | n/a | implemented | root vs contract split plus deterministic summaries |
| section-aware grouping | editing-materialization-reference.md | `BlueChangeCompiler.test.ts` | no | n/a | implemented | preserves existing section membership where present |
| contract atomic replacement | editing-materialization-reference.md | `BlueChangeCompiler.test.ts` | no | n/a | implemented | in-contract diffs compile to whole-contract replacement units |
| `DslStubGenerator` | editing-materialization-reference.md | no | no | n/a | deferred | documented in `stage-7-deviations.md` |
| `DslGenerator` | editing-materialization-reference.md | no | no | n/a | deferred | documented in `stage-7-deviations.md` |
| pipeline: counter | stage-7-testing-strategy.md | no | `EditingPipeline.test.ts` | n/a | implemented | add second operation |
| pipeline: handlers | stage-7-testing-strategy.md | no | `EditingPipeline.test.ts` | n/a | implemented | root-field and workflow changes together |
| pipeline: MyOS | stage-7-testing-strategy.md | no | `EditingPipeline.test.ts` | n/a | implemented | access orchestration plus post-grant handler |
| pipeline: AI | stage-7-testing-strategy.md | no | `EditingPipeline.test.ts` | n/a | implemented | AI integration plus response workflow |
| pipeline: PayNote | stage-7-testing-strategy.md | no | `EditingPipeline.test.ts` | n/a | implemented | capture flow plus reserve phase |
