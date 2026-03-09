# Master improvement plan — recommended path to 9–10/10

This plan upgrades the **current mainline** `libs/sdk-dsl` to a 9–10/10 product without replacing its base.
It is the preferred path because it preserves the strongest existing assets:
- runtime correctness
- canonical scenario hardening
- public-repo hygiene
- editing pipeline correctness
- real migration pressure from external consumer usage

## Goal

Raise the current mainline to 9–10/10 in:
1. Java parity
2. DSL/API ergonomics
3. runtime correctness / generated document correctness
4. functional completeness
5. implementation and test quality

## Starting point

The current mainline already has:
- Stage 1–7 implemented
- green verification
- canonical scenarios
- public mapping/materialization docs
- Stage 4.5 hardening
- collision-safe editing pipeline
- real-world migration experience from an external consumer

The biggest remaining gaps are not foundational runtime bugs.
They are mostly:
- ergonomics gaps
- missing public helper APIs
- incomplete parity/completeness surface vs Java
- some monolithic implementation areas
- optional companion-package opportunities

## Progress

- Stage A is complete on the current mainline:
  - public alias-style JSON export is available through `buildJson()` and `nodeToAliasJson(...)`
  - public `contract(...)` and `contracts(...)` helpers are available for normal contract insertion
- Stage B is complete on the current mainline:
  - generic parity helpers are available through `SimpleDocBuilder`
  - change-lifecycle helper surface is available through `contractsPolicy(...)`, `directChange(...)`, `proposeChange(...)`, `acceptChange(...)`, and `rejectChange(...)`
  - marker/link/emission helpers are available through `anchors(...)`, `links(...)`, and `canEmit(...)`
- Stage C is complete on the current mainline:
  - thin payment convenience APIs are available through `triggerPayment(...)`
  - `requestBackwardPayment(...)` is available as a runtime-guarded helper that fails clearly when the installed repository package does not expose the required alias
  - payment payload authoring now has a public `PaymentRequestPayloadBuilder` with rail-specific builders and `ext(...)`
- Stage D is complete on the current mainline:
  - linked-access and agency helper namespaces now cover the richer request / call / subscribe / revoke composition surface
  - AI orchestration remains proven by parity, runtime, and canonical scenario coverage
  - PayNote macro builders now have explicit canonical proof in addition to parity and runtime coverage

## Strategy

Use the current mainline as the only implementation base.

Cherry-pick or reimplement the best ideas from the alternative implementation where they improve:
- parity
- ergonomics
- completeness
- maintainability

Do **not** import alternative runtime assumptions blindly.
Do **not** replace current runtime-confirmed behavior with older/legacy behavior.

## Stage summary

### Stage A — Ergonomics and public export surfaces
Goals:
- add public alias-style JSON export
- add migration-friendly public helpers
- remove the need for external repos to invent local JSON/contract workarounds

Target additions:
- `buildJson()` or equivalent
- `nodeToAliasJson(...)` / `dslNodeToAliasJson(...)`
- `contract(key, contractLike)`
- optional `contracts(record)`

### Stage B — Generic authoring helpers and parity surface
Goals:
- close the biggest Java parity / API-surface gaps
- improve generic authoring ergonomics

Target additions:
- `SimpleDocBuilder`
- `contractsPolicy(...)`
- `directChange(...)`
- `proposeChange(...)`
- `acceptChange(...)`
- `rejectChange(...)`
- `anchors(...)`
- `links(...)`
- `canEmit(...)`

### Stage C — Payment / conversation convenience APIs
Goals:
- add thin convenience APIs that reduce raw escape-hatch usage
- keep them runtime-confirmed and mapping-confirmed

Candidate additions:
- `triggerPayment(...)`
- `requestBackwardPayment(...)`
- any missing conversation/payment thin wrappers that are runtime-confirmed

### Stage D — Macro-builder hardening with real scenarios
Goals:
- explicitly harden the highest-level orchestration APIs:
  - access
  - linked access
  - agency
  - AI orchestration
  - PayNote macros
- prove them against canonical scenario corpus

This stage should reduce dependence on `jsRaw(...)` / `raw(...)` where the DSL can reasonably express the scenario.

### Stage E — Architecture and maintainability uplift
Goals:
- reduce monolithic implementation hotspots
- preserve public API
- improve internal modularity, readability, and change safety

Targets:
- split large builders by domain
- isolate shared internals
- reduce accidental coupling

### Stage F — Optional `myos-js` companion intake
Goals:
- if the alternative reference contains a strong `libs/myos-js`, evaluate it as a separate companion package
- do **not** couple it into `sdk-dsl` runtime
- import only if quality and fit are high

This stage is optional / conditional.
If the donor reference is absent or unsuitable, document deferment and finish the rest of the plan.

### Stage G — Final release hardening
Goals:
- final docs refresh
- examples refresh
- scorecard closure
- no regressions
- final public package quality bar

## Definition of done for the whole plan

The whole plan is done only when:
- all stages are complete or explicitly deferred with justification
- all stage deliverables are implemented
- verification is green
- no regression exists in prior scope
- canonical scenarios remain green
- the scorecard reaches 9–10/10 in all categories
- public docs are consistent with the final implementation
