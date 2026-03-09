# Scorecard

This file is the running quality bar for the whole plan.

Update it after every stage.

## Current baseline (before the plan)

| Category | Baseline | Target |
|---|---:|---:|
| Java parity | 7/10 | 9–10/10 |
| DSL/API ergonomics | 7/10 | 9–10/10 |
| Runtime correctness | 9/10 | 9–10/10 |
| Functional completeness | 7/10 | 9–10/10 |
| Implementation/test quality | 8/10 | 9–10/10 |

## Current snapshot (after Stage A)

| Category | Baseline | Current | Target |
|---|---:|---:|---:|
| Java parity | 7/10 | 7/10 | 9–10/10 |
| DSL/API ergonomics | 7/10 | 8/10 | 9–10/10 |
| Runtime correctness | 9/10 | 9/10 | 9–10/10 |
| Functional completeness | 7/10 | 8/10 | 9–10/10 |
| Implementation/test quality | 8/10 | 8/10 | 9–10/10 |

### Why Stage A moved the score

- `buildJson()` and `nodeToAliasJson(...)` remove the need for consumer-side alias-normalization helpers.
- `contract(...)` and `contracts(...)` remove the need for normal `/contracts/...` pointer hacks and preserve section tracking.
- Full `sdk-dsl` verification remained green after the surface addition, so ergonomics improved without runtime drift.

## Target interpretation

### Java parity — 9–10/10 means
- no major missing generic surface vs Java
- deviations are explicit, narrow, and justified

### DSL/API ergonomics — 9–10/10 means
- common authoring no longer needs structural hacks
- public JSON/contract helpers exist
- APIs read cleanly in both small and large scenarios

### Runtime correctness — 9–10/10 means
- generated docs remain aligned with current runtime and repository schemas
- canonical scenarios and integration proofs stay green

### Functional completeness — 9–10/10 means
- Stage 1–7 surface is complete enough for production use
- major generic helper gaps are closed

### Implementation/test quality — 9–10/10 means
- strong tests at all levels
- modular maintainable implementation
- public docs and public repo hygiene are strong

## Stage impact tracker

| Stage | Main score movement |
|---|---|
| A | ergonomics + completeness |
| B | parity + completeness + ergonomics |
| C | ergonomics + completeness |
| D | runtime correctness + test quality |
| E | implementation/test quality |
| F | ecosystem value / companion tooling |
| G | final polish across all categories |

## Completion bar

Do not call the plan complete unless every category is credibly at **9 or above**.
