# BLUE TS DSL SDK — Stage 4 implementation plan

## High-level goal

Implement the higher-level MyOS interaction builders on top of the Stage 3 foundations without widening scope into AI or payments.

## Phase 0 — Baseline and source review

- Verify Stage 1–3 are green on this branch.
- Read stage-4-relevant sections of `final-dsl-sdk-mapping-reference.md`.
- Search Java refs for:
  - `access(`
  - `accessLinked(`
  - `agency(`
  - nested builder implementations and `.done()` behavior
  - tests covering SDPG / LDPG / worker-agency flows

## Phase 1 — API surface and internal state design

- Define the TypeScript public API for:
  - `access(...)`
  - `accessLinked(...)`
  - `agency(...)`
- Mirror Java nested-builder ergonomics where feasible.
- Decide which reusable Stage 3 primitives the builders should compose internally.
- Keep key generation deterministic.

## Phase 2 — Implement access builders

- Implement the single-document permission builder and its `.done()` behavior.
- Ensure emitted contracts/events align to mapping sections 5.2 and 5.10.
- Add parity coverage.

## Phase 3 — Implement linked-access builders

- Implement the linked-documents permission builder and its `.done()` behavior.
- Align to anchors/links plus mapping sections 5.3, 5.6, and 5.10.
- Add parity coverage.

## Phase 4 — Implement agency builders

- Implement the worker-agency builder and its `.done()` behavior.
- Align to mapping section 5.8.
- Add parity coverage.

## Phase 5 — Implement stage-4 step/helper namespaces

- Implement the related `StepsBuilder` helper namespaces discovered from Java refs.
- Prefer composition over re-implementing raw MyOS event shapes.
- Keep wrappers thin and explicit.

## Phase 6 — Runtime integration matrix

Add processor-backed tests for:
- single-document permission flow
- linked-documents permission flow
- worker-agency flow
- one regression/composition scenario showing Stage 3 helpers still compose cleanly with Stage 4 abstractions

## Phase 7 — Docs and verification

- Update stage-4 spec / mapping / coverage / deviations docs.
- Run verification commands.
- Report exact remaining deviations, if any.
