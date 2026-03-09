# Reference priority and donor policy

This plan depends on multiple reference sources.
They are **not** equal.

## Source-of-truth priority

### Priority 1 — current mainline and current public runtime
This is the top authority for:
- runtime correctness
- generated document correctness
- package behavior already proven by tests
- current public repo hygiene expectations

### Priority 2 — public mapping/materialization docs in this repo
This includes:
- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`
- `docs/ts-dsl-sdk/complex-flow-materialization-reference.md`
- `docs/ts-dsl-sdk/editing-materialization-reference.md`
- canonical scenario docs under `docs/ts-dsl-sdk/canonical-scenarios/**`

These define the public target shape/materialization for the current SDK.

### Priority 3 — Java SDK reference
If present:
- `references/java-sdk/**`

Use Java for:
- API shape
- parity intent
- fluent ergonomics
- small parity scenarios

Do **not** override current runtime-confirmed behavior with Java-only assumptions.

### Priority 4 — alternative implementation donor
If present:
- `references/alternative-sdk-serious/**`

Use it only as a **donor/reference** for:
- missing APIs
- ergonomics ideas
- modularization ideas
- optional companion packages

Do **not** treat it as a new base.
Do **not** import it wholesale.
Do **not** prefer its older runtime assumptions over the current mainline.

## Donor extraction policy

When cherry-picking from the alternative implementation:
1. identify the exact API/helper or modularization to adopt
2. verify it against current runtime/mapping docs
3. reimplement or adapt cleanly in the mainline
4. add tests
5. document the cherry-pick in `cherry-pick-catalog.md`

## Public repo hygiene

References under `references/**` are development-only aids.
They must:
- not become runtime dependencies
- not leak provenance into final public docs/tests
- not be mentioned as private/internal origins in committed public artifacts
