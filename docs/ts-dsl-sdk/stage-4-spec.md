# BLUE TS DSL SDK — Stage 4 spec

## Purpose

Stage 4 adds the **higher-level MyOS interaction DSL** on top of the generic authoring layer from Stages 1–2 and the MyOS/admin foundations from Stage 3.

This stage is where the SDK starts exposing named interaction builders that encode permission, linked-document, and worker-agency flows instead of forcing callers to assemble those flows manually from lower-level MyOS helpers.

## Primary mapping reference

Stage 4 must be implemented against:

- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`

This document is the implementation-ready mapping reference for:
- single-document permission flows,
- linked-documents permission flows,
- worker-agency flows,
- anchors/links semantics,
- request/response/control event shapes,
- canonical grant document patterns.

Java POC remains useful for:
- fluent API shape,
- nested builder behavior,
- naming,
- builder ergonomics,
- scenario discovery,
- parity intent.

When Java POC and the final mapping reference disagree on MyOS platform shapes, the final mapping reference wins.

## Mapping sections relevant to Stage 4

Use these sections directly:
- 2.1 explicit channels in runtime documents
- 2.2 `requestId`
- 2.4 inherited contracts vs explicit duplication
- 3.4 pending actions and customer interactions
- 4.3 `MyOS/MyOS Timeline Channel`
- 5.1 `MyOS/MyOS Admin Base`
- 5.2 single-document permission wrappers
- 5.3 linked-documents permission wrappers
- 5.4 subscription wrappers where needed by access flows
- 5.5 call-operation request and response forwarding where needed by access flows
- 5.6 anchors and links
- 5.8 worker agency
- 5.10 canonical grant document patterns
- 8.2 Stage 4 implications

## Scope

### In scope

#### DocBuilder helpers
- `access(...)`
- `accessLinked(...)`
- `agency(...)`
- nested fluent builders and `.done()` for the above

#### StepsBuilder helpers
- stage-4 helper namespaces related to those integrations, discovered from Java refs
- representative composition helpers for:
  - single-document permission request + follow-up flow
  - linked-documents permission request + follow-up flow
  - worker-agency permission request + worker-session start flow

#### Tests and docs
- stage-4 parity tests
- stage-4 runtime integration tests
- stage-4 docs / coverage / deviation tracking

### Out of scope

- AI builders and AI workflows
- payment helpers and PayNote implementation
- patch/editing compiler work
- participants orchestration helpers unless directly required by an in-scope mapped scenario
- endpoint payload modeling beyond already-defined runtime documents/events

## Core semantics

### `access(...)`
This builder must encode the canonical single-document permission interaction pattern using the runtime-confirmed MyOS request/control event shapes.

The builder should compose Stage 3 primitives rather than bypass them.

### `accessLinked(...)`
This builder must encode the linked-documents permission interaction pattern and align to runtime-confirmed anchors/links semantics and request/response/control events.

### `agency(...)`
This builder must encode the worker-agency permission interaction pattern and the follow-up worker-session start request semantics where applicable.

### Builder behavior
The exact fluent API surface should be ported from Java as closely as practical.
When Java surface and runtime mapping do not align 1:1, preserve the runtime-correct mapping and document the deviation.

## Exit criteria

Stage 4 is complete when:
- the stage-4 APIs exist,
- their parity coverage is in place,
- runtime integration proves real behavior,
- Stage 1–3 behavior is not regressed,
- deviations are explicit and justified,
- the implementation is aligned to the final mapping reference.
