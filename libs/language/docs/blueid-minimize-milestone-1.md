# BlueId And Minimize Milestone 1 Scope

## Goal

Milestone 1 delivers spec-correct BlueId calculation for ordinary
single-document inputs and adds minimization that preserves identity for that
same scope. It combines Phase A and Phase C after the Phase 0 foundation work.

## In Scope

- Single-document inputs.
- Acyclic graphs.
- JSON, YAML, and `BlueNode` inputs routed through public Blue APIs.
- Specification cleaning and wrapper normalization before hashing.
- Exact pure-reference short-circuit only for `{ blueId: "..." }`.
- Empty lists preserved as content-bearing present-empty lists.
- `$empty: true` treated as content when it appears as a list placeholder.
- Minimized authoring output that re-resolves to the same resolved state and
  keeps the same BlueId.

## Out Of Scope

- Combined BlueId for direct cyclic document sets.
- `this#` references.
- `$pos` positional overlays.
- `$previous` append anchors and append-anchor optimization.
- `ResolvedSnapshot`.
- Document-processor runtime refactor.
- Structural sharing and copy-on-write patching.

## Specification Anchors

The local specification source is:

```text
/Users/mjonak/www-apps/work/Blue/language-blue/content/spec.md
```

Milestone 1 is anchored on:

- Section 8.2: cleaning, canonical wrapped shape, object shape, and list control
  form treatment.
- Section 8.3: map hashing and exact pure-reference short-circuit.
- Section 8.4: list hashing, including the empty-list seed.
- Section 10.1: minimization rules.
- Sections 12.4 through 12.7: null, empty object, empty list, `$empty`,
  `$previous`, `$pos`, and list conformance expectations.

## Phase 0 Baseline Gaps

Phase 0 intentionally does not fix these gaps. It records them so Phase A can
change behavior with clear before/after coverage:

- The current low-level calculator removes empty lists during cleaning.
- The current low-level calculator returns any `blueId` field as authoritative,
  even when the object has additional keys.
- The current list hash starts from the first item instead of the specification
  empty-list domain seed.
- The current low-level calculator does not normalize authoring scalar/list
  sugar to canonical wrapped form before hashing.

## Phase 0 Benchmark Baseline

The tracked baseline result is:

```text
libs/language/scripts/benchmark/baselines/calculate-blue-id-baseline.json
```

It was generated with:

```text
BENCH_SAVE_BASELINE=1 BENCH_ITERATIONS=1 BENCH_WARMUP_ITERATIONS=1 BENCH_LARGE_LIST_ITEMS=200 BENCH_EMPTY_LIST_FIELDS=50 BENCH_REFERENCE_FIELDS=100 node scripts/benchmark/calculateBlueId.mjs
```

The generated fixture data remains under the ignored `scripts/benchmark/data/`
directory; only the baseline result is intended to be committed.

## Acceptance Criteria For Milestone 1

- `Blue.calculateBlueId*()` uses one authoritative spec-canonical identity path.
- Equivalent authoring sugar and wrapped forms produce identical BlueIds.
- Empty list and absent field produce different BlueIds.
- Exact `{ blueId: "..." }` references short-circuit; extended maps do not.
- `this#`, `$pos`, and `$previous` are rejected until Phase B.
- `Blue.minimize(...)` and related APIs preserve resolved state and BlueId for
  this milestone scope.
