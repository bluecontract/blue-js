# ADR-004: Minimize API

## Status

Accepted for Phase 0.

## Context

The specification defines minimization as a minimal authoring view that
re-resolves to the same resolved snapshot and the same BlueId. The current code
has `MergeReverser` and `ResolvedBlueNode.getMinimalNode()`, but these are not a
complete public minimization contract.

## Decision

Phase C will introduce first-class minimization APIs:

- `Blue.minimize(...)`
- `Blue.minimizeResolved(...)`
- `Blue.resolveAndMinimize(...)`

The output type will be named as minimized or minimal authoring output, not as
canonical output.

## Consequences

Phase 0 and Phase A do not add public minimization APIs. Characterization tests
may cover existing `MergeReverser` behavior, but that behavior is not promoted
to the final public contract until Phase C.
