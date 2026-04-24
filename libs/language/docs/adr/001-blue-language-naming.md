# ADR-001: Blue Language Naming

## Status

Accepted for Phase 0.

## Context

The Blue language specification uses "canonical representation" for the wrapped
form used before BlueId hashing. Phase A will introduce a spec-correct
normalization path, while Phase C will introduce minimization. These are related
but distinct concepts.

## Decision

Use names that preserve the specification boundary:

- `BlueNode` or `AuthoringBlueNode` for authoring input.
- `SpecCanonicalNode` for the post-preprocessing, post-cleaning, wrapped form
  described by specification section 8.2.
- `MinimizedNode` or `MinimalAuthoringNode` for the output of minimization.
- `ResolvedSnapshot` for the resolved state planned for the later snapshot
  milestone.

Do not call minimized output "canonical". In the specification, canonical means
the wrapped representation used for identity hashing.

## Consequences

Phase A can focus on canonical BlueId hashing without implying a minimizer.
Phase C can expose minimization without changing the meaning of canonical
wrapped form.
