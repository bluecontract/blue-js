# Stage 7 deviations

Use this file only for real, justified deviations.

## Accepted deviations

### Generic patch values preserve typed node envelopes
- **Status:** accepted
- **Area:** patch
- **Minimal repro:**
  ```ts
  const before = DocBuilder.doc().field('/counter', 1).buildDocument()
  const after = DocBuilder.from(before.clone()).replace('/counter', 2).buildDocument()
  const operations = DocPatch.from(before).diff(after).build()
  ```
- **Java/reference expectation:** Java patch tests emphasize the operation kind and path, but do not define a strict serialized JSON payload shape for typed scalar nodes.
- **TS/runtime reality:** the current public runtime materializes authored scalar nodes as explicit typed inline nodes, not as bare JSON scalars.
- **Decision:** `DocPatch` keeps the root path field-oriented, e.g. `/counter`, while preserving typed scalar values through the Stage-7 editing JSON envelope.
- **Reason:** this keeps the patch layer generic and lossless without collapsing runtime-confirmed type information.
- **Regression test:** `libs/sdk-dsl/src/__tests__/DocPatch.test.ts` / `replaces a scalar root field deterministically`

### `DslStubGenerator` and `DslGenerator` deferred after core pipeline completion
- **Status:** accepted
- **Area:** generator
- **Minimal repro:**
  ```ts
  // No public generator surface is exported in Stage 7 yet.
  ```
- **Java/reference expectation:** Java exposes both generator helpers and tests them directly.
- **TS/runtime reality:** stable TS-first generator output would require reverse-inferring author intent from already materialized macro flows and workflow implementations. That is a different risk profile than the core editing pipeline and would be easy to get wrong if rushed.
- **Decision:** Stage 7 ships the fully tested extraction / patch / change-planning pipeline now and defers generator helpers to a dedicated follow-up pass.
- **Reason:** the user requested the editing pipeline specifically and asked not to widen scope beyond it.
- **Regression test:** coverage gap tracked in `docs/ts-dsl-sdk/stage-7-coverage-matrix.md`
