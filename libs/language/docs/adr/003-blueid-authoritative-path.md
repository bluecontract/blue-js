# ADR-003: BlueId Authoritative Path

## Status

Accepted for Phase 0.

## Context

The current repository has several direct call-sites of
`BlueIdCalculator.calculateBlueId*()` in providers, merge/type utilities, tests,
benchmarks, and document-processor code. Phase A needs one authoritative
identity path that matches the specification.

## Decision

Phase A will make public BlueId calculation flow through:

```text
input -> preprocess -> clean -> wrapper normalization -> special reference/list handling -> RFC 8785 JSON -> SHA-256 -> Base58
```

The source of identity for Phase A is `SpecCanonicalNode`, not
`ResolvedSnapshot` and not `MinimizedNode`.

## Consequences

Phase 0 records all current call-sites before changing behavior. Later phases
can migrate production paths intentionally and preserve any legacy calculator
only as a debug or compatibility aid, not as the source of truth.
