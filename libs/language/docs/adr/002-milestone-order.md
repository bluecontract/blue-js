# ADR-002: Milestone Order

## Status

Accepted for Phase 0.

## Context

The main business goal is stable, spec-correct BlueId calculation and identity
preservation through minimization. Full language support for cycles and advanced
list control forms is important, but it has a larger implementation surface.

## Decision

Implement the language work in this order:

1. Foundations and characterization.
2. Phase A: BlueId Core.
3. Phase C: Minimization.
4. Phase D: ResolvedSnapshot, document-processor, and performance.
5. Phase B: cycles and advanced list control forms.

Phase B remains required for fuller language conformance, but it is not a
prerequisite for the single-document, acyclic identity/minimization milestone.

## Consequences

Milestone 1 deliberately supports a smaller profile: single-document, acyclic
documents, no `this#`, no `$pos`, and no `$previous`. Deferred features must be
rejected explicitly in Phase A instead of being hashed incorrectly.
