# BLUE TS DSL SDK — Stage 4 testing strategy

## Goals

Stage 4 tests prove:
1. the higher-level interaction builders generate the intended runtime-correct BLUE structures,
2. those structures execute correctly with the current processor/runtime,
3. Stage 1–3 behavior stays green.

## Primary oracle

Parity keeps the same oracle as Stage 1–3:
- preprocess actual and expected nodes,
- compare canonical `official` JSON,
- compare BlueIds when helpful,
- keep YAML fixtures readable but non-authoritative.

## Implemented suites

### Parity

Primary parity file:
- `libs/sdk-dsl/src/__tests__/DocBuilder.interactions.parity.test.ts`

Covered there:
- single-document access lifecycle parity,
- linked-documents access lifecycle parity,
- worker-agency lifecycle parity,
- manual access / linked-access / agency step composition,
- section tracking for generated contracts,
- builder and helper guardrails tied to Stage 4.

Supporting low-level parity / shape coverage:
- `libs/sdk-dsl/src/__tests__/StepsBuilder.myos.test.ts`

Covered there:
- linked-doc request helpers,
- revoke helpers,
- worker-agency helpers,
- worker-session payload helpers.

### Runtime

Primary runtime file:
- `libs/sdk-dsl/src/__tests__/DocBuilder.interactions.integration.test.ts`

Covered there:
- single-document permission flow through grant and subscription-ready events,
- linked-documents grant flow correlated by `requestId`,
- worker-agency grant flow that emits a worker-session start request,
- Stage 3 + Stage 4 composition regression.

Existing Stage 3 runtime coverage remains relevant for shared matcher primitives and MyOS admin delivery behavior:
- `libs/sdk-dsl/src/__tests__/DocBuilder.myos.integration.test.ts`

### Guardrails

Guardrail coverage is split between:
- `DocBuilder.interactions.parity.test.ts`
- `StepsBuilder.myos.test.ts`

Covered guardrails:
- unknown `steps.access(...)` / `steps.viaAgency(...)` references,
- missing linked-access links,
- `subscribeToCreatedSessions(true)` fail-fast behavior,
- unsupported legacy fields staying absent from generated request payloads,
- runtime-correct worker-session envelope,
- section tracking for generated contracts.

## Java traceability

Stage-4-relevant scenario sources came primarily from:
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderInteractionsDslParityTest.java`
- `references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderMyOsDslParityTest.java`

Java was used for scenario intent and fluent shape. Final runtime mapping documents remained authoritative whenever they differed.

## Documentation coupling

These files must stay synchronized with the real implementation:
- `stage-4-spec.md`
- `stage-4-mapping-matrix.md`
- `stage-4-coverage-matrix.md`
- `stage-4-deviations.md`
