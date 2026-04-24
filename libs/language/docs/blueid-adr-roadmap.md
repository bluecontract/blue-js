# BlueId + Minimization ADRs and roadmap

This document records architecture decisions for identity/minimization work and
the phased roadmap across Milestones 1–3.

It is intended to be the long-lived reference for:

- why the work was sliced in the selected order,
- what was intentionally deferred,
- what “done” means per milestone.

---

## ADR-001 — Naming aligned with spec semantics

- **Canonical representation** refers to the wrapped form (`value` / `items`)
  used in BlueId normalization.
- **Minimized form** is a distinct concept (`minimize()` output) and should not
  be called canonical.

Adopted vocabulary:

- `BlueNode` / authoring node
- `SpecCanonicalNode` (normalized wrapped hash input)
- `MinimizedNode` / minimal authoring node
- `ResolvedSnapshot` (resolved runtime view, milestone 2+)

## ADR-002 — Delivery order

Adopted order:

1. Foundations (Phase 0)
2. Phase A — BlueId core
3. Phase C — Minimization
4. Phase D — ResolvedSnapshot + processor/runtime migration
5. Phase B — cycles and advanced list control

Rationale: deliver stable identity + minimization invariants first, then runtime
model migration, then full complex language compatibility.

## ADR-003 — BlueId source of truth

BlueId is computed from preprocessed + cleaned + wrapper-normalized content
(`SpecCanonicalNode` path), not from minimized/resolved-only structures.

Public APIs must route through one authoritative path.

## ADR-004 — Minimization is first-class API

Expose explicit minimization APIs:

- `Blue.minimize(...)`
- `Blue.minimizeResolved(...)`
- `Blue.resolveAndMinimize(...)`

`Blue.reverse(...)` remains a compatibility alias.

## ADR-005 — Fail-fast for deferred features

Until Phase B is implemented:

- `this#...`, `$pos`, `$previous` in BlueId/minimize flows must throw
  `UnsupportedFeatureError`.
- `$empty` remains valid content and contributes to identity.

## ADR-006 — Snapshot/runtime migration is separate from BlueId/minimize

`ResolvedSnapshot` and processor internals are milestone-2 concerns and do not
block milestone-1 identity/minimize correctness.

---

## Milestone roadmap

### Milestone 1 (Phases A + C) — completed

Primary outcomes:

- canonical BlueId pipeline unified,
- strict pure-reference semantics,
- empty-list preservation in identity,
- explicit unsupported-feature guard for deferred forms,
- minimization APIs and invariants added.

### Milestone 2 (Phase D) — planned

Target outcomes:

- add `ResolvedSnapshot` API and conversion layer,
- introduce `Blue.resolveToSnapshot(...)`,
- migrate document-processor runtime boundaries to snapshot-safe semantics,
- preserve behavior while reducing mutation hazards and clone churn.

### Milestone 3 (Phase B) — deferred

Target outcomes:

- cycle support (`this#` / set-level hashing flow),
- advanced list controls (`$pos`, `$previous`, full semantics),
- append optimization using previous list identity.

---

## Phase-level hard DoD

### DoD: Milestone 1

1. One authoritative BlueId path in production APIs.
2. Wrapper-equivalent authoring forms hash identically.
3. `[]` presence affects identity (not removed as empty).
4. Pure-reference short-circuit only for exact `{ blueId: ... }`.
5. Minimization APIs available and tested.
6. `resolve(minimize(resolve(doc)))` snapshot equivalence validated.
7. BlueId invariance across authoring/resolved/minimized validated.
8. Deferred forms fail explicitly; `$empty` supported.

### DoD: Milestone 2

1. `ResolvedSnapshot` publicly available.
2. `resolveToSnapshot` available and tested.
3. Snapshot -> node roundtrip deterministic.
4. Processor runtime passes full suite with snapshot boundary safeguards.
5. Typecheck + lint clean for touched libs.

### DoD: Milestone 3

1. `this#` supported end-to-end.
2. `$pos`, `$previous`, `$empty` semantics fully implemented.
3. List merge/hash behavior validated for advanced forms.

