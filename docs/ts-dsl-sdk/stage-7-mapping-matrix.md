# Stage 7 mapping matrix

This stage maps editing DSL/runtime surfaces to extraction and patch/change outputs.

| Surface | Input | Output / materialization | Notes |
|---|---|---|---|
| `DocStructure.from(node)` | `BlueNode` | stable summary of metadata, fields, contracts, sections, policies | best-effort classification, never throw on unknown contracts |
| `DocStructure.toSummaryJson()` | extracted structure | deterministic JSON summary | primary machine-readable editing surface |
| `DocStructure.toPromptText()` | extracted structure | compact deterministic text summary | for human/agent editing prompts |
| `DocPatch.from(original)` | original `BlueNode` | mutable generic patch builder | generic RFC-6902 style layer |
| `DocPatch.build()` | original vs modified JSON | ordered generic patch ops | no BLUE-specific inference |
| `DocPatch.apply()` | node + patch ops | patched node | deterministic helper for tests |
| `BlueChangeCompiler.compile(before, after)` | two docs or two summaries | `BlueChangePlan` | BLUE-aware split between root and contract changes |
| contract diff in `BlueChangeCompiler` | changed contract body | whole-contract replacement unit | never partial in-contract patch |
| section-aware grouping | changed contract with known section | grouped under existing section | preserve known authoring structure |
| fallback grouping | changed unsectioned contract | grouped to inferred bucket | deterministic heuristic |
| `DslStubGenerator` | structure summary | TS-first stub text | optional but recommended |
| `DslGenerator` | structure summary / document | TS-first generator output | optional if feasible in this stage |
