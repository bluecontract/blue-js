# Stage 7 mapping matrix

This stage maps editing DSL/runtime surfaces to extraction and patch/change outputs.

| Surface | Input | Output / materialization | Notes |
|---|---|---|---|
| `DocStructure.from(node)` | `BlueNode` | stable summary of metadata, fields, contracts, sections, policies | best-effort classification, never throw on unknown contracts |
| `DocStructure.toSummaryJson()` | extracted structure | deterministic JSON summary | primary machine-readable editing surface |
| `DocStructure.toPromptText()` | extracted structure | compact deterministic text summary | for human/agent editing prompts |
| Stage-7 editing JSON | `BlueNode` | plain JSON for plain nodes, `$sdkDslNode` / `$sdkDslItems` envelopes for metadata-bearing nodes | keeps patch paths field-oriented while preserving typed payloads |
| `DocPatch.from(original)` | original `BlueNode` | mutable generic patch builder | generic RFC-6902 style layer |
| `DocPatch.build()` | original vs modified editing JSON | ordered generic patch ops | no BLUE-specific inference |
| `DocPatch.apply()` | node + patch ops | patched node | deterministic helper for tests |
| `BlueChangeCompiler.compile(before, after)` | two docs or two summaries | `BlueChangePlan` | BLUE-aware split between root and contract changes |
| contract diff in `BlueChangeCompiler` | changed contract body | whole-contract replacement unit | never partial in-contract patch |
| section-aware grouping | changed contract with known section | grouped under existing section | preserve known authoring structure |
| fallback grouping | changed unsectioned contract | grouped to inferred bucket | deterministic heuristic |
| `DslStubGenerator` | structure summary | TS-first stub text | deferred in current Stage 7 pass |
| `DslGenerator` | structure summary / document | TS-first generator output | deferred in current Stage 7 pass |
