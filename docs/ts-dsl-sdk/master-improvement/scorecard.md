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

## Current snapshot (after Stage B)

| Category | After Stage A | Current | Target |
|---|---:|---:|---:|
| Java parity | 7/10 | 8/10 | 9–10/10 |
| DSL/API ergonomics | 8/10 | 9/10 | 9–10/10 |
| Runtime correctness | 9/10 | 9/10 | 9–10/10 |
| Functional completeness | 8/10 | 9/10 | 9–10/10 |
| Implementation/test quality | 8/10 | 8/10 | 9–10/10 |

### Why Stage B moved the score

- `SimpleDocBuilder` closes a long-standing Java parity gap without breaking the current mainline builder surface.
- `contractsPolicy(...)`, `directChange(...)`, `proposeChange(...)`, `acceptChange(...)`, and `rejectChange(...)` close the generic change-lifecycle authoring gap on top of repo-confirmed contract types.
- `anchors(...)`, `links(...)`, and `canEmit(...)` remove more raw fallback pressure and cover common marker/link/emission authoring directly.
- Runtime proofs now exist for both `directChange(...)` and `canEmit(...)`, so the new surface is not parity-only.

## Current snapshot (after Stage C)

| Category | After Stage B | Current | Target |
|---|---:|---:|---:|
| Java parity | 8/10 | 9/10 | 9–10/10 |
| DSL/API ergonomics | 9/10 | 9/10 | 9–10/10 |
| Runtime correctness | 9/10 | 9/10 | 9–10/10 |
| Functional completeness | 9/10 | 9/10 | 9–10/10 |
| Implementation/test quality | 8/10 | 8/10 | 9–10/10 |

### Why Stage C moved the score

- `triggerPayment(...)` closes the thin payment-emission convenience gap without introducing a second macro layer next to the Stage 6 PayNote builders.
- `PaymentRequestPayloadBuilder` and its rail builders remove another common reason to drop to raw payload objects for payment events.
- `requestBackwardPayment(...)` now fails explicitly against the currently installed repository surface instead of inviting consumers to author an event that cannot resolve on the public runtime.
- Shape tests and runtime proof exist for the new convenience layer, but larger orchestration surfaces and internal modularity work still remain for later stages.

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

## Current snapshot (after Stage D)

| Category | After Stage C | Current | Target |
|---|---:|---:|---:|
| Java parity | 9/10 | 9/10 | 9–10/10 |
| DSL/API ergonomics | 9/10 | 9/10 | 9–10/10 |
| Runtime correctness | 9/10 | 10/10 | 9–10/10 |
| Functional completeness | 9/10 | 9/10 | 9–10/10 |
| Implementation/test quality | 8/10 | 9/10 | 9–10/10 |

### Why Stage D moved the score

- The highest-level orchestration surfaces now have explicit parity, runtime, and canonical proof instead of relying on partial evidence from earlier stages.
- `steps.accessLinked(...)` and the richer `steps.viaAgency(...)` surface reduce another class of raw fallback for complex MyOS session orchestration.
- PayNote macros now have canonical capture-lifecycle coverage in addition to parity and runtime integration tests, which closes the most obvious proof gap on the Stage 6 macro surface.

## Current snapshot (after Stage E)

| Category | After Stage D | Current | Target |
|---|---:|---:|---:|
| Java parity | 9/10 | 9/10 | 9–10/10 |
| DSL/API ergonomics | 9/10 | 9/10 | 9–10/10 |
| Runtime correctness | 10/10 | 10/10 | 9–10/10 |
| Functional completeness | 9/10 | 9/10 | 9–10/10 |
| Implementation/test quality | 9/10 | 10/10 | 9–10/10 |

### Why Stage E moved the score

- The largest interaction-related builder code is now split by domain instead of accumulating in two monolithic files.
- Public behavior stayed unchanged while the refactor remained fully covered by the existing parity, runtime, canonical, and editing suites.
- Interaction-domain changes are now isolated enough to reduce regression risk for future maintenance work and targeted cherry-picks.

## Current snapshot (after Stage F)

| Category | After Stage E | Current | Target |
|---|---:|---:|---:|
| Java parity | 9/10 | 9/10 | 9–10/10 |
| DSL/API ergonomics | 9/10 | 9/10 | 9–10/10 |
| Runtime correctness | 10/10 | 10/10 | 9–10/10 |
| Functional completeness | 9/10 | 9/10 | 9–10/10 |
| Implementation/test quality | 10/10 | 10/10 | 9–10/10 |

### Why Stage F did not move the score

- The donor `libs/myos-js` package was evaluated and found to be a strong transport/API companion, but not a missing `sdk-dsl` authoring-layer capability.
- Deferring intake keeps the uplift focused on `sdk-dsl` itself instead of widening into HTTP clients, OpenAPI generation, and live-environment support.
- The `sdk-dsl` score remains at or above the target bar without importing a companion package into this plan.

## Completion bar

Do not call the plan complete unless every category is credibly at **9 or above**.
