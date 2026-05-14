# Blue Language Runtime Roadmap and Historical Implementation Plan

Last updated: 2026-04-30

Status: Phase 1 and Phase 2 identity/storage work is implemented. Phase 3
resolved snapshots remain planned.

This document is intentionally detailed. It is both a durable roadmap for future
runtime work and a historical record of the implementation decisions that led to
the current `libs/language` release state.

## 1. Context

Historically, `libs/language` mixed four different concepts:

- **official / wrapped form**: the specification form using `value` / `items`;
- **minimal overlay form**: the output of minimization;
- **resolved tree**: the runtime form;
- **BlueId**: sometimes calculated from input, sometimes from provider content,
  and sometimes from reverse/minimize output.

That was the root cause of the identity issues. `resolve()` cost matters, but
the primary problem was the absence of one identity semantics. The specification
is clear about the target: the official canonical shape is the wrapped form,
`BlueId` must be stable across equivalent authoring forms and across
expansion/resolution, pure-reference short-circuiting applies only to exact
`{ blueId: ... }`, empty lists are meaningful, and minimization must preserve
both the snapshot and the `BlueId`. ([language.blue][1])

The target for `language` is therefore:

- public `Blue.calculateBlueId*` = **semantic BlueId**;
- providers store **minimal overlay form** under the semantic `BlueId`;
- `resolve()` returns the current mutable resolved runtime tree, while Phase 3
  adds `resolveToSnapshot()`;
- spec-native list forms (`$previous`, `$pos`, `$empty`) are handled before
  snapshots;
- direct cycles with `this#k` are the final conformance path before snapshots.
  ([language.blue][1])

## 2. Design / ADR Summary

### ADR-01 - Terminology Is Part Of The API

Reserve the word **canonical** only for:

- the specification wrapped shape;
- RFC 8785 canonical JSON.

Do not use `canonical` for minimal overlay content.

Code and docs use four terms:

- `official` / `wrapped`;
- `minimal`;
- `resolved`;
- `semantic BlueId`.

This matters because the specification already calls the wrapped form the
"official canonical representation". ([language.blue][1])

### ADR-02 - Public `Blue.calculateBlueId*` Means Semantic Identity

The public API calculates semantic `BlueId`, not a hash of a transient
materialization.

Target pipeline:

- authoring / official input -> `preprocess -> resolve -> minimize -> hash(minimal)`;
- resolved input -> `minimize -> hash(minimal)`;
- minimal input -> `validateStorageShape -> hash(minimal)`.

The low-level hasher remains available, but it is no longer the main application
identity source. This follows directly from the requirement that expansion must
not change `BlueId`, and that minimization must preserve the same snapshot and
the same `BlueId`. ([language.blue][1])

### ADR-03 - `blueId` In The Model Is A Reference, Not Computed Identity

Separate:

- `referenceBlueId`;
- computed / semantic identity.

The document field is still named `blueId`, but in the `BlueNode` model it must
not be treated as the node's own ID. The specification says a node cannot store
its own `BlueId` as authoritative content; `{ blueId: ... }` is a reference.
([language.blue][1])

Practical contract:

- new code uses `getReferenceBlueId()` / `setReferenceBlueId()`;
- `getBlueId()` / `setBlueId()` remain temporary deprecated aliases so the
  monorepo does not need to migrate all call sites at once.

### ADR-04 - Minimization And Provider Storage Move Together

This is the key change relative to earlier plans.

`minimize()` becomes a first-class API, and providers store **minimal overlay
form**, not "preprocessed JSON" and not a resolved explosion. This belongs in
the same phase as semantic `BlueId`, because the specification says minimization
must recover the same resolved snapshot and the same `BlueId`. Identity cannot
be fixed without also fixing storage semantics. ([language.blue][1])

Important caveat: until the final list/cycle phases, minimal overlay format for
two families was allowed to be internally transitional:

- list overlays;
- direct cyclic multi-document sets.

After Phase 1, storage is already minimal-first, but the final public storage
contract for those two special families was not declared complete until their
dedicated work was done.

### ADR-05 - Direct Cycles Come Before Snapshots

After identity, storage, and list controls are stable, direct cyclic sets with
`this#k` are finalized so snapshots do not later need to change their `BlueId`
caching model.

Required order:

- direct-cycle combined BlueId with `this#k`;
- `MASTER#i` as final identity for cyclic-set documents;
- only then `ResolvedSnapshot`.

### ADR-06 - Snapshots Must Be DP-Ready

After `this#k` is closed, add:

- `ResolvedSnapshot`;
- freeze/finalization;
- lazy caches;
- path-based copy-on-write.

The specification already describes resolve as producing a finalized resolved
snapshot. The snapshot should therefore be based on the final semantic `BlueId`,
including `MASTER#i`. ([language.blue][1])

## 3. Implementation Plan And Status

## Phase 0 - Guardrails, Glossary, Red Tests, Benchmark Baseline

### Goal

Set the terminology and create a safety net before the larger refactor.

### Implementation

- add `docs/adr/` with the ADRs above;
- add `docs/glossary.md`;
- add a fixture matrix under `libs/language/src/lib/__fixtures__/identity/`;
- add benchmark baselines:
  - `calculate-blue-id`;
  - `resolve`;
  - new `snapshot-patch` placeholder for a later phase.

### Fixture Matrix

Minimum:

- scalar sugar vs wrapped scalar;
- list sugar vs wrapped list;
- pure ref;
- materialized ref subtree;
- mixed `blueId + payload` in authoring/storage input;
- present-empty list;
- append-only list;
- positional list;
- direct cyclic 2-doc set;
- resolved inherited-type tree.

### Tests

At the end of Phase 0:

- fixtures are ready;
- benchmark baseline is saved;
- red tests exist for the target semantics.

### Natural PR Split

- PR-0A: glossary + ADR;
- PR-0B: fixtures + benchmark baseline.

---

## Phase 1 - Semantic BlueId Core + Minimize + Provider/Storage

This became the main phase. It combines the earlier "1, 2, and 3" work.

### Goal

Deliver **one identity semantics** and immediately move storage to minimal
overlay.

### Stream 1A - Low-Level Hasher Compatible With Section 8

#### Implementation

Extract the identity layer, for example:

- `src/lib/identity/BlueIdHashNormalizer.ts`;
- `src/lib/identity/BlueIdHasher.ts`;

or an equivalent refactor of the existing `BlueIdCalculator`.

Rules:

- pure-ref short-circuit only for exact `{ blueId }`;
- remove `null` and `{}`;
- preserve `[]`;
- wrapper equivalence for `value` and `items`;
- list hash uses `id([])` plus domain-separated fold;
- scalar hash uses canonical JSON scalar;
- map hashing does not rely on the public JSON serializer.
  This is directly described in Sections 8 and 12. ([language.blue][1])

#### Files

- `src/lib/utils/BlueIdCalculator.ts`;
- new `src/lib/identity/*`;
- detach hash path from `src/lib/utils/NodeToMapListOrValue.ts`.

#### Tests

- `[] != absent`;
- `[A] != A`;
- `[[A,B],C] != [A,B,C]`;
- `x: 1` == `x: { value: 1 }`;
- `x: [a,b]` == `x: { items: [a,b] }`;
- mixed `blueId + payload` does not short-circuit.

### Stream 1B - Semantic Pipeline

#### Implementation

Add `SemanticIdentityService`.

Public APIs:

- `Blue.calculateBlueId*` moves to the semantic pipeline;
- `Blue.minimize()` becomes public;
- `Blue.reverse()` remains as a deprecated alias until cleanup.

#### Model

- `Node.ts`:
  - `getReferenceBlueId()`;
  - `setReferenceBlueId()`;
  - deprecated `getBlueId()/setBlueId()` aliases.

#### Important Validation

**Storage/authoring ingest** rejects ambiguous mixed `blueId + payload`, while
**resolved/materialized runtime trees** are not blocked by that rule.

In other words:

- authoring/storage path: strict;
- internal resolved path: materialized ref subtree is allowed, but without
  pure-ref short-circuit.

This matters because expansion must preserve identity, while pure-ref
short-circuiting must apply only to the exact reference form. ([language.blue][1])

#### Files

- `src/lib/Blue.ts`;
- `src/lib/model/Node.ts`;
- `src/lib/model/ResolvedNode.ts`;
- `src/lib/utils/Nodes.ts`;
- call sites using `getBlueId()/setBlueId()`.

#### Tests

- authoring / resolved / minimal have the same `BlueId`;
- `PathLimits` do not change `BlueId`;
- expansion does not change `BlueId`;
- storage/authoring input with mixed `blueId + payload` is rejected.
  ([language.blue][1])

### Stream 1C - Minimizer + Provider/Storage

#### Implementation

Turn `reverse()` logic into an explicit `Minimizer`.

Providers:

- `NodeContentHandler`;
- `BasicNodeProvider`;
- `RepositoryBasedNodeProvider`;
- `InMemoryNodeProvider`;

move to:

- parse/preprocess;
- semantic identity pipeline;
- store `minimalOverlay + semanticBlueId`.

If the caller supplies `providedBlueId` and it does not match the semantic ID:

- reject.

#### Important Caveat

Until Phase 3, minimal overlay for:

- list overlays;
- direct cycles;

may still have an internally transitional format. This does not block the phase,
because this is not a final major release contract yet.

#### Tests

- fetch by BlueId returns minimal overlay;
- `resolve(fetch(id))` gives the correct snapshot;
- provider does not store a resolved explosion;
- provider rejects mismatched `providedBlueId`.

### Stream 1D - Benchmarks And Docs

#### Implementation

- update README;
- update `docs/blue-id.md`;
- update `docs/resolve.md`;
- document the distinction between:
  - official;
  - minimal;
  - resolved;
  - semantic BlueId.

#### Tests

- `calculate-blue-id` benchmark: no meaningful regression;
- `resolve` benchmark: no meaningful regression;
- new golden docs / examples.

### Phase 1 Exit Criteria

After this phase:

- for ordinary documents, `Blue.calculateBlueId*` has the correct semantics;
- providers store minimal overlay;
- `document-processor` may still not use snapshots;
- list control forms and `this#k` are not yet final.

### Natural PR Split

- PR-1A: hasher core;
- PR-1B: semantic pipeline + model semantics;
- PR-1C: minimizer + providers;
- PR-1D: docs + deprecations.

---

## Current Status - Phase 1 Stabilization

Status after implementing the 1E/1F/1G/1H stabilization block and the strict
provider cleanup: semantic storage is now the only normal provider ingest path.
Provider ingest either stores minimal content under its semantic `BlueId` or
fails immediately. `BaseContentNodeProvider` remains an audited bootstrap-only
raw-ID exception for transformation resources.

### Done

- `BasicNodeProvider`, `InMemoryNodeProvider`, and
  `RepositoryBasedNodeProvider` now use the shared semantic storage identity
  path instead of deriving storage truth without a full `resolve()`.
- `BasicNodeProvider` and `InMemoryNodeProvider` no longer have a resolve-error
  fallback to storage overlay.
- Repository `contents` keys are checked against semantic `BlueId`; historical
  package keys are no longer exposed as fetchable storage IDs.
- Repository ingest still uses constructor-local bootstrap maps so repository
  entries can resolve references to each other while loading. Those maps are
  cleared after strict semantic ID verification and are not a public
  historical-ID compatibility path.
- `providedBlueId` and repository content keys are checked against the semantic
  `BlueId`, not against the old hash of the preprocessed/minimized authoring
  form.
- `NodeContentHandler` delegates storage processing, and semantic storage runs
  preprocess, full resolve, `minimizeResolved()`, and low-level hashing of the
  minimal form.
- Root `blueId + payload` is rejected during provider ingest, the same as
  nested mixed reference payloads.
- `this` / `this#k` are special only in `blueId` fields. Ordinary scalar
  strings such as `value: this` and list item `"this#1"` remain normal content.
- Provider/storage ingest accepts top-level document sets with indexed
  `blueId: this#k` and stores them under `MASTER`; single-node `blueId: this`
  remains unsupported.
- `StorageShapeValidator.validateStorageShape()` rejects full payload-kind
  ambiguity: `blueId + payload`, `value + items`, `value/items + child fields`,
  and document-level `properties`.
- `SemanticIdentityService` has separate internal paths:
  `minimizeResolved()`, `minimizeAuthoring()`, and `hashMinimalTrusted()`.
- The minimizer no longer exposes public materialized-reference collapse hooks
  and does not generically collapse `blueId + payload` nodes to `{ blueId }`.
- Root instance `name` and `description` are preserved by minimization even when
  they equal the referenced type's `name` / `description`.
- Resolved/runtime nodes carry the minimum completeness metadata:
  `completeness: 'full' | 'path-limited'` and `sourceSemanticBlueId`.
- Path-limited `resolve()` no longer computes a full semantic `BlueId` just to
  set metadata. `sourceSemanticBlueId` is internal provenance metadata and is
  set only from a valid exact root pure reference; invalid symbolic anchors are
  rejected.
- `ResolvedBlueNode.getMinimalNode()` and `getMinimalBlueId()` now respect the
  path-limited guard and return the source reference only when the source
  semantic ID is known.
- `resolve()` now has caches for type overlays, node hashes, list hashes,
  subtype checks, and provider fetches per `blueId`; the per-typed-node clone of
  the resolved type overlay was removed.
- A mutation-leak regression test covers exposed resolved type objects so user
  mutations do not contaminate later resolves.
- `calculateBlueId` is treated as a low-level hash benchmark, while the separate
  semantic API benchmark covers authoring, resolved, explicitly named
  minimal-shaped authoring, and provider ingest cases.
- The semantic benchmark does not expose a public trusted-minimal hash API. The
  minimal-shaped authoring scenario is named
  `public-semantic-id-on-minimal-shaped-authoring` and uses the public semantic
  identity path.
- `snapshot-patch` remains a `patch-then-full-resolve` benchmark until Phase 3.
- Resolver-invalid tests use direct/raw test providers instead of relying on
  provider fallback to ingest invalid content.
- `$previous` stale anchors are now consumed as optimization hints and the
  effective list is recomputed against the current inherited prefix instead of
  throwing or trusting the stale seed.
- Public semantic identity no longer treats arbitrary wrapped/node
  list-control authoring input as trusted minimal storage; only internal trusted
  minimal hashing can pass `$previous` directly to the low-level hasher.
- Public top-level arrays passed to `Blue.calculateBlueId*` now normalize
  through list context before hashing. Top-level `$previous`, `$pos`, and
  `$empty` can no longer bypass semantic list-control handling by being treated
  as independent root nodes.
- `document-processor` `/blueId` and external event checkpoint IDs use semantic
  calculated identity instead of `getBlueId()` fallback. Operation Request
  document pins remain explicit reference targets when a resolved/materialized
  request still carries a reference `blueId`.
- The `@blue-repository/types` bridge rewrites indexed references such as
  `OLD#1 -> NEW#1`.
- `NodeExtender.mergeNodes()` clones provider-owned content before attaching it
  to expanded runtime nodes.

### Verification Run

- `nx build language --skip-nx-cache` - passed.
- `nx tsc language --skip-nx-cache` - passed.
- `nx lint language` - passed.
- `nx test language --skip-nx-cache` - passed: 574 passed, 4 skipped, 5 todo.
- `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit` - passed.
- `npx eslint libs/document-processor --fix` - passed.
- `nx test document-processor --skip-nx-cache` - passed: 349 passed.
- Benchmark refresh on 2026-04-28, Apple M1 Pro, Node `v22.22.1`, default
  config `2` warmup / `10` measured iterations, after
  `npx nx build language --skip-nx-cache`:
  - `node scripts/benchmark/calculateBlueId.mjs`: low-level hash avg
    `10891.02 ms`, baseline delta `-2343.03 ms (-17.70%)`.
  - `BENCH_COMPARE_BASELINE=1 node scripts/benchmark/semanticBlueId.mjs`:
    authoring no-type avg `4.79 ms`, authoring shared-type avg `1.89 ms`,
    resolved avg `0.16 ms`, public semantic ID on minimal-shaped authoring avg
    `1.78 ms`, provider ingest avg `0.58 ms`; passed against the existing
    semantic baseline with deltas: authoring no-type `+0.04 ms (+0.90%)`,
    authoring shared-type `+0.09 ms (+5.27%)`, resolved
    `+0.09 ms (+139.23%)`, public semantic ID on minimal-shaped authoring
    `+0.10 ms (+5.93%)`, provider ingest `+0.01 ms (+1.33%)`.
  - `node scripts/benchmark/resolve.mjs`: shared resolve avg `48.15 ms`,
    baseline delta `-249.51 ms (-83.82%)`; clone total avg `165019`, baseline
    delta `-369719 (-69.14%)`.
  - `BENCH_TYPE_MODE=unique node scripts/benchmark/resolve.mjs`: unique
    resolve avg `1647.42 ms`, baseline delta `+45.23 ms (+2.82%)`; clone
    total avg `528612`, baseline delta `-441599 (-45.52%)`.
  - `node scripts/benchmark/snapshotPatch.mjs`: patch-then-full-resolve avg
    `2.00 ms`, baseline delta `-0.30 ms (-12.96%)`; clone total avg `10506`,
    baseline delta `-3900 (-27.07%)`.

### Main-vs-Develop Benchmark Refresh - 2026-04-30

This run was recorded to make the performance comparison explicit against the
then-current `main` code rather than only against the checked-in Phase 0
baseline files.

#### Environment

- Machine: Apple M1 Pro, `arm64`, 10 physical CPUs / 10 logical CPUs, 32 GiB
  RAM.
- OS: macOS `26.3.1 (a)`, build `25D771280a`.
- Node: `/Users/mjonak/.nvm/versions/node/v22.22.1/bin/node`, `v22.22.1`.
- Baseline commit: `origin/main`
  `6be9d4c66b3616c8bbdd4a6a6baf1b54b4c04142`
  (`chore(release): publish 3.11.0`).
- Compared develop commit:
  `78be17a61edf8c7dfed930a854420f78ce92ea10`
  (`Merge pull request #191 from bluecontract/codex/fix-node-type-matcher-collection-types`).
- Both sides were built with `npx nx build language --skip-nx-cache` before
  running the benchmark scripts.
- Default benchmark config was used unless noted: `2` warmup iterations and
  `10` measured iterations.

#### Methodology

- A detached worktree was created from `origin/main` at `/tmp/blue-js-main-bench`.
- The current develop benchmark harness was copied into that worktree so both
  sides used the same generated input shapes, timing code, clone counters, and
  baseline comparison logic.
- The main worktree did not have `Blue.minimize()` yet. For the semantic
  benchmark fixture preparation, the copied harness used `blue.minimize(resolved)`
  when available and fell back to `blue.reverse(resolved)` on main. The measured
  semantic scenarios still call the public `blue.calculateBlueIdSync(...)` API.
- Main baseline files were saved outside the repository under
  `/tmp/blue-main-bench-baselines` and then used as
  `BENCH_COMPARE_BASELINE=1 BENCH_BASELINE_FILE=...` inputs for the develop run.
- The `resolve` benchmark uses deterministic generated input on both sides:
  `300` object properties, `300` list items, `60` type properties, `6`
  per-node payload properties. `shared` uses one type for all 600 typed nodes;
  `unique` uses 600 distinct types.
- `snapshotPatch` is still a patch-then-full-resolve benchmark, not a Phase 3
  structural snapshot patch benchmark.

#### Main Baseline Results

| Benchmark                               |      Main avg |      Main min |      Main max |
| --------------------------------------- | ------------: | ------------: | ------------: |
| `calculateBlueId` low-level hash        | `13909.71 ms` | `12815.32 ms` | `15807.81 ms` |
| semantic authoring no-type              |     `1.03 ms` |     `0.85 ms` |     `1.28 ms` |
| semantic authoring shared-type          |     `0.02 ms` |     `0.02 ms` |     `0.03 ms` |
| semantic resolved                       |     `0.26 ms` |     `0.21 ms` |     `0.51 ms` |
| semantic minimal-shaped authoring       |     `0.01 ms` |     `0.01 ms` |     `0.02 ms` |
| semantic provider ingest                |     `0.31 ms` |     `0.23 ms` |     `0.52 ms` |
| `resolve(shared)`                       |   `318.71 ms` |   `302.13 ms` |   `345.18 ms` |
| `resolve(unique)`                       |  `1563.64 ms` |  `1496.31 ms` |  `1653.44 ms` |
| `snapshotPatch` patch-then-full-resolve |     `2.57 ms` |     `1.70 ms` |     `4.86 ms` |

Main clone-count baselines:

| Benchmark                               | `clone()` avg | `cloneShallow()` avg | total clone avg |
| --------------------------------------- | ------------: | -------------------: | --------------: |
| `resolve(shared)`                       |      `518765` |              `15973` |        `534738` |
| `resolve(unique)`                       |      `735603` |             `234608` |        `970211` |
| `snapshotPatch` patch-then-full-resolve |        `8102` |               `6304` |         `14406` |

#### Develop Compared With Main Baseline

| Benchmark                               |      Main avg |   Develop avg |                   Delta |
| --------------------------------------- | ------------: | ------------: | ----------------------: |
| `calculateBlueId` low-level hash        | `13909.71 ms` | `10194.75 ms` | `-3714.96 ms (-26.71%)` |
| semantic authoring no-type              |     `1.03 ms` |     `4.78 ms` |   `+3.75 ms (+364.40%)` |
| semantic authoring shared-type          |     `0.02 ms` |     `1.85 ms` |  `+1.82 ms (+8161.52%)` |
| semantic resolved                       |     `0.26 ms` |     `0.12 ms` |    `-0.14 ms (-54.48%)` |
| semantic minimal-shaped authoring       |     `0.01 ms` |     `1.69 ms` | `+1.68 ms (+12100.18%)` |
| semantic provider ingest                |     `0.31 ms` |     `0.61 ms` |    `+0.30 ms (+95.48%)` |
| `resolve(shared)`                       |   `318.71 ms` |    `42.91 ms` |  `-275.80 ms (-86.54%)` |
| `resolve(unique)`                       |  `1563.64 ms` |  `1682.61 ms` |   `+118.97 ms (+7.61%)` |
| `snapshotPatch` patch-then-full-resolve |     `2.57 ms` |     `2.02 ms` |    `-0.55 ms (-21.21%)` |

Develop clone-count comparison:

| Benchmark                               | Main total clone avg | Develop total clone avg |               Delta |
| --------------------------------------- | -------------------: | ----------------------: | ------------------: |
| `resolve(shared)`                       |             `534738` |                `165019` | `-369719 (-69.14%)` |
| `resolve(unique)`                       |             `970211` |                `528612` | `-441599 (-45.52%)` |
| `snapshotPatch` patch-then-full-resolve |              `14406` |                 `10506` |   `-3900 (-27.07%)` |

More detailed clone breakdown:

| Benchmark                               |     `clone()` delta | `cloneShallow()` delta |   total clone delta |
| --------------------------------------- | ------------------: | ---------------------: | ------------------: |
| `resolve(shared)`                       | `-373983 (-72.09%)` |      `+4264 (+26.70%)` | `-369719 (-69.14%)` |
| `resolve(unique)`                       | `-482402 (-65.58%)` |     `+40803 (+17.39%)` | `-441599 (-45.52%)` |
| `snapshotPatch` patch-then-full-resolve |   `-6001 (-74.07%)` |      `+2101 (+33.33%)` |   `-3900 (-27.07%)` |

#### Interpretation

- `resolve(shared)` is the clearest win from the stabilization work: the same
  deterministic input is `86.54%` faster than main, and total clone calls are
  down `69.14%`. This is the path where many nodes point at the same
  provider-backed type, so resolved-type/type-overlay reuse pays off.
- `resolve(unique)` is `7.61%` slower than main on wall-clock time, but remains
  inside the `+10%` regression gate while total clone calls are down `45.52%`.
  This is the case with 600 distinct types, so it benefits less from type-overlay
  reuse than the shared-type benchmark.
- The public semantic identity benchmark is intentionally not equivalent to the
  old main identity semantics. On develop, public `Blue.calculateBlueId*` uses
  the semantic path: authoring input is resolved, minimized, then hashed; an
  already resolved node is minimized, then hashed; only a trusted minimal
  storage path may skip re-resolution. Main often measured a pre-semantic hash
  over the available shape, so typed and minimal-shaped authoring inputs could
  appear near-zero because they were not proving the same semantic contract.
- The large percentage increases in semantic authoring cases should therefore
  be read as the cost of semantic correctness over very small historical
  baselines, not as apples-to-apples regressions. The most important examples
  are:
  - `semantic authoring shared-type`: develop resolves the provider-backed type
    and minimizes before hashing; the old path did not perform the same work.
  - `semantic minimal-shaped authoring`: the public API cannot safely assume an
    arbitrary input is trusted minimal storage, so it resolves/minimizes again.
  - `semantic provider ingest`: provider storage now preprocesses, resolves,
    minimizes, validates storage shape, and stores minimal overlay under the
    semantic BlueId.
- The low-level hash benchmark is faster on develop (`-26.71%`) and remains
  separate from public semantic identity. It is the right signal for the
  Section 8 hasher itself, not for end-to-end semantic identity.
- `snapshotPatch` is still full resolve after patching. It is useful as a
  pre-snapshot baseline, but Phase 3 must replace this with a true structural
  snapshot benchmark that reports path-local work: copied nodes, recalculated
  hashes, resolved/materialized nodes, provider fetches, and whether the patch
  touched only `O(depth)` nodes.
- The next performance target is not to weaken public semantic BlueId. It is to
  add explicit trusted storage/snapshot load paths so code that reads a node
  previously persisted through `nodeToJsonValue`/`Blue.nodeToJson(...)` and
  rehydrated through `jsonValueToNode` can avoid the public
  `resolve -> minimize -> hash` path when the stored minimal shape is already
  trusted or has just been verified.

### Deliberate Transitional Behavior

1. **BaseContentNodeProvider bootstrap IDs.** Transformation resources still use
   raw bootstrap IDs. This is an explicit bootstrap-only exception, not normal
   provider/storage ingest.
2. **Path-limited resolved trees.** Partial materialization must not pretend to
   be a full resolved snapshot or become a normal hash source without
   `sourceSemanticBlueId`.
3. **External Blue Repository Types.** The installed `@blue-repository/types`
   package still ships historical/pre-semantic storage keys. `document-processor`
   uses an explicit semantic reindex adapter for that package; `language`
   remains strict and does not add a normal historical-ID provider bypass.
4. **Operation Request document pins.** A `document` field in an Operation
   Request is a version pin/reference. If a resolved or materialized request
   still carries a reference `blueId`, DP treats that reference as the pinned
   document version. Inline document payloads without a reference use semantic
   calculated identity.

### Decisions Before Phase 2

- Blue Repository Types are reindexed at the `document-processor` boundary by
  an explicit adapter. Long term, the package should publish semantic IDs
  directly; the strict provider path still does not include a dual-index/alias
  adapter in `language`.
- Repository semantic reindexing must preserve `typesMeta.status`. A `dev` type
  with empty `versions` remains `dev`; reindexing must not promote it to
  `stable`.
- Path-limited nodes now have the Phase 1 public contract: no eager full
  semantic identity calculation; source identity must be supplied by caller or
  be trivially known from an exact root reference.
- Matcher/type structural identity is intentionally not changed in this Phase 1
  finalization release. `name`/`description` can still affect existing matcher
  behavior because `Common/Named Event` and downstream contracts rely on that
  pattern today. A future release may introduce matcher-neutral labels only
  after those contracts are migrated to content fields such as `kind`,
  `operation`, or `eventKind`, or to explicit exact BlueId matching.
- Public `nodeToJson()` / `nodeToYaml()` are lossless projections of the
  current `BlueNode` shape and preserve materialized `blueId + payload`
  metadata. Storage-safe content is produced by minimization and
  `SemanticStorageService`, not by the serializer.
- Direct `NodeToObjectConverter` usage must inject `calculateBlueId`; the
  default raw `BlueIdCalculator` path is removed. `Blue.nodeToSchemaOutput()`
  remains the public convenience API and injects semantic identity.
- `dsl-sdk` may continue importing `createDefaultMergingProcessor` from
  `document-processor` in this phase. That dependency is not part of the
  identity boundary cleanup.
- Phase 1K owns spec-native `$previous`, `$pos`, and `$empty`. Phase 2 owns
  direct cyclic `this#k` support before snapshots. Legacy inherited-list
  markers are not a normal storage format in Phase 1.
- Top-level arrays passed to public `Blue.calculateBlueId*` are semantic lists,
  not a bag of independent root nodes. They must normalize through list context
  so `BlueNode[]`, JSON arrays, and pure `items` wrappers agree for the same
  list content.
- Phase 3 snapshots should not start until Phase 2 direct cycles and Phase 1M
  remain green for both `language` and `document-processor`.

---

## Phase 1M - Top-Level Array List-Control Closure

### Goal

Close the last public semantic identity gap before Phase 2: top-level array
input to `Blue.calculateBlueId*` must be treated as a list, not as a set of
separate root nodes. This matters for `$previous`, `$pos`, and `$empty`,
because the specification recognizes these forms only as list elements.

### Problem

The previous public pipeline for `BlueNode[]` minimized each array item
separately, then `hashMinimalTrusted()` validated each item as a root node. That
lost `insideItems: true` for top-level arrays:

- `$previous` on the first item could reach the low-level hasher as a trusted
  seed;
- malformed `$empty` could bypass exact list-control item validation;
- `$pos` could reach the raw hasher and throw a technical error instead of being
  consumed or rejected by semantic list normalization.

### Implementation

- Add a separate public array-input path in `SemanticIdentityService`:
  - build a temporary wrapper with `new BlueNode().setItems(items)`;
  - pass the wrapper through `minimizeAuthoring()` / semantic list
    normalization;
  - return `minimalWrapper.getItems() ?? []` as the minimal list to hash.
- Add `StorageShapeValidator.validateStorageListShape(nodes)` or an equivalent
  helper and use it in `hashMinimalTrusted()` / `hashMinimalTrustedAsync()` for
  arrays, instead of validating each element as a root.
- Preserve internal trusted minimal behavior in the low-level hasher:
  `$previous` may seed the fold only after list-context validation.
- Do not change pure list wrapper semantics: top-level `BlueNode[]`, JSON array,
  and a node with only `items` must have the same semantic `BlueId` for the same
  effective list.

### Tests

- `Blue.calculateBlueIdSync([{ $previous: { blueId: fakePrefixId } }, 'C'])`
  gives the same result as `Blue.calculateBlueIdSync(['C'])`.
- The same case passes for top-level `BlueNode[]`, not only JSON array.
- Malformed top-level array `$empty`, for example `{ $empty: false }` and
  `{ $empty: true, value: 'extra' }`, is rejected with a `$empty` message.
- A top-level array with `$pos` does not reach raw `BlueIdHasher`; it is
  consumed or rejected by semantic list normalization.
- Async/sync parity covers top-level arrays with list controls.
- Equivalence regression: `blue.calculateBlueIdSync(['A', 'B'])` ==
  `blue.calculateBlueIdSync(new BlueNode().setItems([A, B]))`, provided the
  wrapper has no extra identity-bearing fields.

### Acceptance

Phase 1 can be marked final DONE when:

- public top-level arrays go through semantic list normalization;
- top-level array `$previous` is not blindly trusted;
- top-level array `$empty` is validated as exact list-control content;
- top-level array `$pos` never reaches raw `BlueIdHasher`;
- `nx test language --skip-nx-cache`,
  `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit`,
  `npx eslint libs/document-processor --fix`, and
  `nx test document-processor --skip-nx-cache` are green, or any transitional
  failures from later phases are explicitly accepted.

---

## Phase 1N - Repo-Wide Semantic BlueId Migration

### Goal

Close Phase 1 outside `libs/language`: downstream packages must no longer use
historical/raw identity paths as the public truth for types, runtime
repositories, or SDK behavior. `language` owns the shared semantic adapter, and
`document-processor` remains the boundary that temporarily adapts the current
`@blue-repository/types`.

### Decisions

- Add `reindexRepositoryForSemanticStorage(repository, options?)` in
  `@blue-labs/language`. The adapter rewrites `aliases`, `contents`,
  `typesMeta`, `schemas`, exact `blueId` references, and indexed references
  `OLD#i -> NEW#i`. It does not rewrite `repositoryVersions`, because
  repository history remains a raw/version fingerprint, not public semantic type
  identity.
- Adapter cache cannot be shared across different `mergingProcessor` instances.
  The default path may cache by repository identity; custom processors go
  uncached or use a separate processor-identity key.
- `document-processor` imports raw `@blue-repository/types` and reindexes it
  through the `language` adapter at its own boundary, but does not expose that
  bridge as shared public API. Other libraries build their own local bridge
  through `reindexRepositoryForSemanticStorage()`.
- `dsl-sdk` no longer constructs `Blue` from raw `@blue-repository/types`.
  Runtime identity uses a local semantic repository bridge built with
  `reindexRepositoryForSemanticStorage()`; raw schema imports may remain only as
  validators, not as identity sources.
- `repository-generator` moves to a hard semantic switch. Do not add
  `allowIdentityAlgorithmMigration`; the normal guard
  `content is unchanged but BlueId differs` remains active so implicit metadata
  changes are detected.
- Source `.blue` in `repository-generator` is specification Blue authoring
  input, not a separate DSL with an escape hatch for reserved field names. User
  attributes cannot be named `value`, `items`, `blueId`, `blue`, or
  `properties`; `value` remains allowed only as a scalar node payload.
- `repoDoc.computeRepoBlueId()` remains a raw structural fingerprint for the
  repository version and is intentionally separate from public semantic type
  identity.
- `SemanticIdentityService.hashMinimalTrusted*()` is an internal trusted path,
  not public API.
- `@blueId` in schema output means public semantic identity: the mapper receives
  an injected calculator from `Blue.nodeToSchemaOutput()`.

### Implementation

- Move reindexing helpers from `document-processor` to
  `libs/language/src/lib/repository/SemanticRepositoryReindexer.ts` and add
  tests for convergence, exact/id-index rewrite, schema/type metadata rewrite,
  and strict repository key validation after reindexing.
- Slim `libs/document-processor/src/repository/semantic-repository.ts` down to
  an internal boundary adapter over raw `@blue-repository/types`; do not export
  semantic repository from public `src/index.ts`.
- In `dsl-sdk`, replace raw repository construction and raw conversation alias
  imports with its own local semantic bridge based on
  `reindexRepositoryForSemanticStorage()`; update `runtime-type-support.ts` so
  it reads aliases from the local semantic repository.
- In `repository-generator`, calculate `typeBlueId` semantically while
  preserving hardcoded primitive/core IDs. The generator builds an incremental
  provider keyed by semantic IDs in topological order, substitutes known aliases,
  preserves official JSON source content after parse/preprocess, and registers
  aliases for later types. Primitive/core IDs are not seeded into the provider
  as ordinary repository content, so built-in basic type semantics are not
  overwritten.
- Remove the generator parser/normalizer path that treated
  `value: { type: ... }` as an attribute name. Generator source must go through
  `Blue.jsonValueToNode()` and `Blue.calculateBlueIdSync()`, and spec-invalid
  reserved field usage must be rejected by the normal language/storage path.
- Rename `aliasToPreprocessed` to a semantic storage name such as
  `aliasToStorageContent`, and remove old `normalizeForBlueId` as a public
  generator path.
- Regenerate generator fixtures/snapshots:
  `base/BlueRepository.blue`, `non-breaking/BlueRepository.blue`,
  `dev-change/BlueRepository.blue`, and inline snapshots.
- Clean up normal provider/repository test usage of `BlueIdCalculator` in
  `language`. Raw calculator remains only for the low-level hasher, CID,
  bootstrap-only paths, internal structural caches, and explicitly historical
  repository-version fixtures.

### Acceptance

Repo-wide Phase 1 is DONE only when:

- `repository-generator` no longer uses raw `BlueIdCalculator` as public
  `typeBlueId` truth;
- `dsl-sdk` does not load raw `@blue-repository/types` as a runtime repository;
- `document-processor` has an internal semantic repository bridge, and `dsl-sdk`
  builds its own bridge through `language` instead of importing repository from
  DP;
- `@blueId` schema output uses semantic calculator;
- raw `BlueIdCalculator` usages in `language` are internal/low-level or
  documented historical fixtures;
- these checks pass:
  - `npx tsc -p libs/language/tsconfig.lib.json --noEmit`;
  - `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit`;
  - `npx tsc -p libs/repository-generator/tsconfig.lib.json --noEmit`;
  - `npx tsc -p libs/dsl-sdk/tsconfig.lib.json --noEmit`;
  - `npx eslint libs/language libs/document-processor libs/repository-generator libs/dsl-sdk --fix`;
  - `npx nx test language --skip-nx-cache`;
  - `npx nx test document-processor --skip-nx-cache`;
  - `npx nx test repository-generator --skip-nx-cache`;
  - `npx nx test dsl-sdk --skip-nx-cache`.

---

## Phase 1E - Semantic Provider/Storage Parity

### Goal

Close Phase 1 so providers and public API calculate the same semantic `BlueId`
for the same document. This blocks snapshots: storage cannot have its own
shorter identity path.

### Implementation

- `NodeContentHandler` stops treating `BlueIdCalculator` after
  preprocess/minimize as storage truth.
- Provider ingest uses the same semantics as `Blue.calculateBlueId*`:
  - validate authoring/storage shape;
  - preprocess;
  - `resolve(NO_LIMITS)`;
  - `minimizeResolved(fullResolved)`;
  - validate minimal storage shape;
  - low-level hash minimal form.
- `providedBlueId` is compared with the semantic `BlueId`, not with the hash of
  preprocessed authoring form.
- `BasicNodeProvider`, `RepositoryBasedNodeProvider`, and `InMemoryNodeProvider`
  store minimal overlay under semantic `BlueId`.
- Multi-doc direct cyclic sets are closed in Phase 2:
  - top-level document sets with indexed `this#k` are calculated under
    `MASTER`;
  - single-document `blueId: this` / local self-refs remain outside normal
    provider ingest scope.

### Tests

- provider stores content under the same ID as `Blue.calculateBlueIdSync()`,
  including inherited redundant fields;
- provider rejects `providedBlueId` if it does not match semantic ID;
- fetch by semantic ID returns minimal overlay which gives the same snapshot
  after `resolve()`;
- `resolve(fetch(id))` preserves semantic `BlueId`;
- top-level multi-doc direct cycles are covered by a `MASTER#i` path test, while
  single-document self-refs are still rejected.

### Exit Criteria

- There is no separate provider identity pipeline.
- Storage truth = minimal overlay keyed by semantic `BlueId`.
- Provider/public API parity tests are green.

---

## Phase 1F - Resolve Performance Hardening

### Goal

Fix the `resolve()` regression before snapshots. Earlier measurements,
`resolve(shared): +573.28%` and `resolve(unique): +106.09%`, were blockers for
Phase 2.

### Implementation

- Add caches in `ResolutionContext`:
  - `nodeHashCache: WeakMap<BlueNode, string>`;
  - `resolvedTypeCache: Map<string, ResolvedBlueNode>`;
  - `typeOverlayCache: Map<string, BlueNode>`;
  - `subtypeCache: Map<string, boolean>`;
  - provider fetch/deserialization cache per `blueId`, if fetch happens in the
    same resolve context.
- Do not run `resolvedType.clone().setType(undefined).setBlueId(undefined)` for
  every typed node. The type overlay without `type` and `blueId` should be
  cached per resolved type artifact.
- Memoize list item hashes used when comparing prefixes.
- Cache subtype checks `(subtypeBlueId, supertypeBlueId) -> boolean`.
- Reduce deep cloning before `ResolvedBlueNode`; snapshots and structural
  sharing will eventually take this over.
- Path-limited resolution should not destroy reuse of the full type artifact:
  limited materialization should be a view/projection with an identity anchor,
  not a new hash base.

### Benchmark Gate

- `resolve(shared)`: at most `+10%` vs Phase 0 baseline.
- `resolve(unique)`: at most `+10%` vs Phase 0 baseline.
- The `calculateBlueId` benchmark is treated as the low-level hash benchmark and
  does not replace the public semantic API benchmark.

### Tests / Benchmarks

- `resolve` benchmark in shared and unique modes as a hard gate;
- regression tests for list prefix comparison without repeatedly hashing the
  same nodes;
- path-limit tests showing stable identity anchors.

---

## Phase 1G - Minimizer Contract Hardening

### Goal

Lock the minimizer contract: minimization must be idempotent, safe for
runtime/materialized nodes, and must not remove unverified payload.

### Target API

- `blue.minimizeResolved(resolvedFullNode)`;
- `blue.minimizeAuthoring(authoringNode)` as
  `resolve(NO_LIMITS) -> minimizeResolved`;
- internal `SemanticIdentityService.hashMinimalTrusted(minimalNode)` as
  `validateStorageShape -> low-level hash`.

Public `Blue.minimize()` may delegate to these paths, but internal code should
not mix authoring, resolved, and storage shapes.

### Hard Rules

- `minimize()` does not operate on partial resolved trees without completeness
  metadata.
- `minimizeResolved(fullResolved)` is idempotent:
  `minimize(resolve(minimize(resolve(x)))) == minimize(resolve(x))`.
- `resolve(minimize(resolve(x)))` gives the same resolved snapshot as
  `resolve(x)`.
- `calculateBlueId(x) == calculateBlueId(minimize(resolve(x)))`.
- Mixed `blueId + payload` may be collapsed only in a trusted materialized
  expansion path.
- Authoring/storage mixed `blueId + payload` remains an error.
- A path-limited resolved tree is not normal minimization input; it may only
  return a source semantic identity anchor.

### Metadata

- Add or plan resolved/runtime metadata:
  - `completeness: 'full' | 'path-limited'`;
  - `sourceMinimal?: BlueNode`;
  - `sourceSemanticBlueId?: string`.

### Tests

- `minimize(resolve(x))` removes inherited redundant values;
- `minimize(resolve(x))` preserves instance overrides;
- untrusted `blueId + payload` is not collapsed to `{ blueId }`;
- trusted materialized provider expansion preserves the same semantic ID;
- path-limited resolved tree does not become a hash source without source
  identity;
- minimization roundtrips through `resolve()` without changing semantic
  `BlueId`.

### Phase 1G Exit Criteria

- Minimizer has separate paths for authoring/resolved/trusted minimal.
- There is no aggressive collapse of every node with `blueId + payload`.
- Golden roundtrip tests are green.

---

## Phase 1H - Storage Shape + Self-Reference + Minimizer Guards

### Goal

Close Phase 1 correctness before snapshots. This is a short stabilization PR,
not a new architecture: it fixes contracts that must be true before Phase 2
starts building immutable snapshots.

### Implementation

- `this` and `this#k` are recognized only as values of the `blueId` field.
  Ordinary strings `this` / `this#1` in `value`, lists, and object fields are
  content.
- `StorageShapeValidator.validateStorageShape()` validates full disjointness of
  payload kinds and rejects document-level `properties`.
- `MergeReverser` knows the root node and preserves root instance `name` /
  `description`, even when they match the type.
- `Blue.resolve(node, limits)` does not accept a public `sourceSemanticBlueId`
  override and does not compute it by itself for path-limited resolve. A valid
  exact root `{ blueId }` is the only metadata source.
- `ResolvedBlueNode.getMinimalNode()` / `getMinimalBlueId()` do not bypass the
  guard for path-limited trees.
- Trusted minimal storage hash remains an internal storage path. The benchmark
  for minimal-shaped authoring input uses the explicit name
  `public-semantic-id-on-minimal-shaped-authoring`, so it does not pretend to be
  a trusted storage path.

### Tests

- Self-reference: ordinary scalar/list strings `this` and `this#1` remain
  content; single-document `blueId: this` / local `blueId: this#k` are rejected,
  and top-level document sets with indexed `this#k` are closed in Phase 2.
- Storage shape: reject `blueId + payload`, `value + items`, `value + child`,
  `items + child`, and literal `properties`; allow reserved metadata `schema`,
  `mergePolicy`, `contracts`.
- Minimizer: root `name` / `description` roundtrip, path-limited minimization
  requires source identity, and cached resolved type mutation does not leak into
  later resolves.

### Exit Criteria

- All `language` tests pass under the new strict storage contract.
- The minimal-shaped input benchmark does not pretend to be a trusted storage
  path; it uses the name `public-semantic-id-on-minimal-shaped-authoring`.
- `docs/PLAN.md` contains current benchmark numbers for Phase 1.

---

## Phase 1I - Final Language Stabilization

### Goal

Close Phase 1 as a breaking change: normal provider/storage ingest no longer
has transitional bypasses, and expansion does not leave `blueId + payload` as
hash input.

### Implementation

- `SemanticStorageService.preparePreprocessedStorageNode()` always goes through
  `minimizeAuthoring() -> hashMinimalTrusted()`.
- Remove `minimizeStorageOverlay()`, `prepareStorageOverlay()`,
  `useTransitionalStoragePath`, and legacy inherited-list marker detection from
  normal storage.
- Provider/storage ingest rejects single-document `blueId: this` and local
  `blueId: this#k`; top-level document sets with indexed `this#k` are closed in
  Phase 2.
- `MinimizerOptions` does not expose `allowMaterializedReferenceCollapse` or
  `isTrustedMaterializedReference`.
- `MergeReverser` does not emit legacy list markers. PR-1K brings spec-native
  list controls into Phase 1, so full-list overlay is no longer the target
  format for inherited-list minimization.
- `NodeExtender` expands only exact pure references, removes the reference
  `blueId` after materialization, and does not flatten the first pure reference
  in an ordinary list.
- `NodeExtender.mergeNodes()` clones provider-owned type/items/properties before
  attaching them to the expanded target so runtime mutations do not leak into
  provider content.
- `resolve()` does not share an exposed mutable `type` object between siblings
  within one resolved tree.

### Tests

- Ordinary list starting with pure `{ blueId }` goes through the semantic
  storage path.
- Provider/storage rejects single-document `blueId: this` and local
  `blueId: this#k`.
- `Blue.extend()` preserves semantic `BlueId`.
- Mutating an expanded target after `Blue.extend()` does not mutate
  provider-stored content.
- NodeExtender does not flatten an ordinary list starting with a pure ref.
- Minimizer does not emit legacy list marker.
- Sibling resolved type mutation does not leak within one `resolve()`.

---

## Phase 1J - Document-Processor Integration Cleanup

### Goal

Prepare `document-processor` for Phase 2 snapshots by removing runtime
dependency on raw `BlueIdCalculator` and spec-invalid fallback repository shape.

### Implementation

- Test fallback repository content uses plain Blue object shape without a
  `properties` field.
- Fallback and derived test repositories are keyed by semantic IDs calculated by
  `seedBlue.calculateBlueIdSync(node)`, and aliases map test names to semantic
  IDs.
- The installed `@blue-repository/types` is reindexed in `document-processor`
  through an explicit adapter that rewrites content, aliases, schemas, and
  metadata to semantic IDs. This is not a normal provider bypass in `language`.
- The reindexing adapter is a migration bridge for the current
  `@blue-repository/types`, which still publishes historical/pre-semantic
  storage IDs. When `blue-repository-js` starts generating semantic IDs
  natively, the adapter should be removed or narrowed to an explicit legacy
  migration path.
- The adapter rewrites both exact IDs and final indexed fragments
  `OLD#i -> NEW#i`.
- `ProcessorEngine.nodeAt(..., '/blueId')` uses only the injected semantic
  `calculateBlueId`; without a calculator, it throws an explicit error.
- Runtime event IDs used by checkpointing are calculated with semantic
  `calculateBlueIdSync(event)`, without fallback to the event reference
  `blueId`.
- Operation Request `document` pin preserves reference `blueId` as an explicit
  pinned document version; inline payload without reference uses the semantic
  calculator.
- Test support and DP tests do not use raw `BlueIdCalculator`.

### Tests

- Fallback repo loads without `properties`.
- `/blueId` uses injected semantic calculator.
- Event checkpoint ID uses semantic calculator.
- Operation Request document pin handles resolved/materialized reference and
  inline semantic payload.
- Repository bridge rewrites `blueId: OLD#1` to `blueId: NEW#1`.
- `document-processor` passes type-check, lint, and tests after identity change.

---

## Phase 1K - List Control Forms

### Goal

Close list identity before snapshots: normal minimal overlay for inherited lists
uses spec-native `$previous`, `$pos`, and `$empty`, without legacy first-item
markers and without transitional full-list overlay as a write path.

### Implementation

- `ListControls` defines the internal contract for:
  - `$previous`: exact first item `{ $previous: { blueId: <itemsListBlueId> } }`;
  - `$pos`: non-negative integer metadata on the item, only for
    `mergePolicy: positional`;
  - `$empty`: ordinary content, not metadata.
- `Merger` resolves list controls in the inherited target list context:
  - default `mergePolicy` is `positional`;
  - `append-only` rejects `$pos`;
  - `$pos` refinements target the final merged index;
  - duplicate, non-integer, and out-of-range `$pos` throw explicit errors;
  - malformed `$previous` remains an error;
  - stale `$previous` is consumed and ignored as an outdated optimization hint;
    resolver recomputes the effective list from the current inherited prefix.
- `MergeReverser` minimizes inherited appends as `$previous + delta`, and
  positional refinements as `$previous + $pos`; append-only non-prefix mutation
  throws.
- `BlueIdHasher` seeds list fold from `$previous` for appends and rejects raw
  `$pos`, because `$pos` must be consumed by semantic normalization before
  hashing.
- Public `Blue.calculateBlueId*` does not treat arbitrary authoring input with
  `$previous` as trusted minimal storage; untrusted controls go through semantic
  resolve/minimize.
- Hash-path rationale: append-only `$previous` can start the fold from the
  previous list BlueId and continue folding new elements. `$pos` cannot be
  calculated from only the previous list BlueId, because replacing a final index
  requires materialized previous list elements.
- `hashMinimalTrusted` materializes minimal input with `$pos` through semantic
  resolve + hash-only minimization without re-emitting controls.
- Path-limited resolve uses final indexes for controls. When a `$previous`
  anchor is present but the inherited prefix was not materialized by the limit,
  resolver materializes the append delta without raw-index filtering; this
  preserves correctness at the cost of broader delta materialization.

### Tests

- `$previous` append-only minimal has the same semantic `BlueId` as the full
  list.
- Stale `$previous` does not throw and does not poison the public semantic hash
  seed.
- Public semantic BlueId ignores unverified `$previous` without inherited
  prefix.
- Minimizer emits `$previous`, not legacy pure-reference marker.
- Ordinary first item `{ blueId: ... }` remains content.
- `$pos` handles positional refinement and appends in final order.
- Duplicate, non-integer, and out-of-range `$pos` throw errors.
- `append-only` rejects `$pos`.
- `$previous` not as the first item is rejected.
- `$empty` affects `BlueId` as an ordinary element.
- PathLimits select appends relative to final list indexes, not raw control item
  indexes.

### Exit Criteria

- `nx test language` passes with list controls in Phase 1.
- Phase 3 snapshots can start without planned list-overlay rewriting on the way.

---

## Phase 1L - Public API And List-Control Closure

### Goal

Close the last public/runtime gaps after Phase 1K before snapshots start:
semantic identity must be consistent for async/sync, resolved/minimal `$pos`,
materialized typed list items, exact `$empty` shape, and path-limited `$pos`.

### Decisions

- Top-level utility `calculateBlueId` / `calculateBlueIdSync` from `src/utils`
  is removed from public exports. Public semantic identity is only
  `Blue.calculateBlueId*`; the explicit low-level hasher remains
  `BlueIdCalculator`.
- `ResolvedBlueNode.getMinimalBlueId()` remains only as a compatibility shim and
  is marked deprecated. New code should use `blue.calculateBlueIdSync(resolved)`.
- `$previous.blueId` for minimized inherited lists means the semantic identity
  of the previous item prefix, not the raw hash of materialized runtime items.

### Implementation

- `ResolvedBlueNode.getMinimalBlueId()` uses hash-only minimization, so resolved
  minimal overlay with `$pos` does not reach `BlueIdHasher` raw.
- `SemanticIdentityService.calculateBlueId()` uses the async equivalent of
  `hashMinimalTrusted()`, including `StorageShapeValidator`.
- `MergeReverser` and `Merger` compare runtime list items through hash-only
  semantic minimization, so typed/materialized items do not produce raw mismatch.
- `$empty` is validated as exact item `{ $empty: true }`; malformed `$empty`
  and combinations with `$previous` / `$pos` are invalid storage shape.
- Path-limited `$pos` overlays are applied relative to final inherited indexes,
  then the result is projected to the limit.
- `enrichWithBlueId` uses semantic `Blue.calculateBlueId(...)`.

### Tests

- `getMinimalBlueId()` for resolved positional `$pos`.
- Async/sync parity for `$pos`, stale `$previous`, inherited list controls, and
  mixed `blueId + payload` validation.
- Semantic `$previous` for inherited typed/materialized list items.
- Path-limited typed full-list overlay without false `Mismatched items`.
- Exact `$empty` validation.
- PathLimits + `$pos` selects the final merged index.

### Exit Criteria

- `npx vitest run --config libs/language/vite.config.ts` passes.
- `npx tsc -p libs/document-processor/tsconfig.lib.json --noEmit` passes.
- `npx eslint libs/document-processor --fix` leaves no lint errors.
- `nx test document-processor --skip-nx-cache` passes, or a real Nx/Vitest
  runtime blocker is explicitly documented.

---

## Phase 2 - Direct Cycles Before Snapshots

The old "#this" shorthand is interpreted as `this#k` from Section 11.

### Goal

Close spec direct cyclic sets before building snapshots, so the later runtime
artifact caches final `MASTER#i` identities from the start instead of a
transitional document-list semantics.

### Implementation

Implement Section 11 for a top-level document set:

- ZERO sentinel;
- preliminary IDs calculated through semantic normalization / minimal trusted
  hash;
- lexicographic sort by preliminary IDs;
- rewrite to `this#k`;
- MASTER list hash calculated through the same semantic hash path;
- final `MASTER#i`.

During preliminary and MASTER hashing, `ZERO` and `this#k` are treated as opaque
references so semantic resolve does not try to fetch them as real types. If two
documents receive the same preliminary BlueId, the implementation throws an
explicit ambiguous cyclic ordering error; specification Section 11 does not yet
define a canonical tie-breaker for that collision.

Public contract:

- `Blue.calculateBlueId*(nodes[])` returns `MASTER`;
- providers store the sorted cyclic set under `MASTER`;
- `fetchByBlueId("MASTER#i")` returns document `i` with `this#k` resolved to
  `MASTER#k`;
- ordinary strings `this` / `this#k` outside `blueId` fields remain content;
- single-node `blueId: this` remains outside this phase.

### Tests

- 2-doc cycle;
- 3-doc cycle;
- stable positions after sorting preliminary IDs;
- preliminary ID collision is rejected as ambiguous ordering;
- cyclic docs with list controls (`$pos`) go through semantic normalization;
- `MASTER#i` stable across writes;
- provider multi-doc ingest works correctly;
- out-of-range and malformed `this#k` throw explicit errors.

### Natural PR Split

- PR-2A: `this#k` + cyclic BlueIds.

---

## Phase 3 - Snapshots

### Goal

Deliver a DP-ready runtime artifact after semantic identity, list controls, and
direct cyclic `MASTER#i` identities are closed. The snapshot must make minimal
storage and resolved runtime state explicit, so future code does not confuse:

- persisted minimal overlay;
- frozen resolved runtime view;
- semantic BlueId;
- optional resolved cache / metadata.

The phase is not just `Object.freeze(resolve(...))`. It must also introduce the
fast load/hash paths needed by provider/database storage that serializes nodes
through `nodeToJsonValue` / `Blue.nodeToJson(...)` and rehydrates them through
`jsonValueToNode`.

### Snapshot Contract

Add `ResolvedSnapshot` and frozen node support under `src/lib/snapshot/*`.
Use `FrozenNode` or `FrozenResolvedBlueNode`; the exact class name is less
important than the invariants below.

`ResolvedSnapshot` must expose or carry:

- `minimalRoot`: the minimal overlay form that is authoritative for storage and
  identity;
- `resolvedRoot`: a frozen resolved view, eager or lazy depending on load mode;
- `blueId`: semantic BlueId of `minimalRoot`;
- `completeness`: at least `full`, `minimal-only`, and `path-limited` where
  needed for compatibility with existing `ResolvedBlueNode` semantics;
- `sourceSemanticBlueId` for path-limited/materialized views that should not
  recalculate identity from partial content;
- lazy caches for minimal JSON, resolved root, path index, and per-node hashes;
- resolve-context metadata: provider identity/version when available,
  resolver limits, and whether the snapshot came from authoring input, trusted
  minimal storage, verified minimal storage, or a resolved cache sidecar.

`minimalRoot` must be first-class, not merely a lazy by-product of
`resolvedRoot`. This follows the existing storage direction: providers store
minimal overlay form under semantic BlueId, while the resolved view is the
runtime artifact.

### Public / Internal APIs

Add APIs with names that make trust boundaries explicit. Suggested shape:

```ts
blue.resolveToSnapshot(authoring: BlueNode, options?: ResolveSnapshotOptions): ResolvedSnapshot;
blue.loadSnapshotFromMinimal(
  minimal: BlueNode | JsonBlueValue,
  options: {
    expectedBlueId?: string;
    trust?: 'trusted-minimal' | 'verify';
    materialize?: 'lazy' | 'eager';
  },
): ResolvedSnapshot;
blue.loadSnapshotFromCache(
  input: {
    minimal: BlueNode | JsonBlueValue;
    resolved?: BlueNode | JsonBlueValue;
    blueId: string;
  },
  options?: { verify?: boolean },
): ResolvedSnapshot;
```

The exact names can change, but the behavior must not:

- `resolveToSnapshot(authoring)` runs the semantic path:
  `preprocess -> resolve -> minimize -> hash(minimal) -> freeze`.
- `loadSnapshotFromMinimal(..., trust: 'verify')` rehydrates minimal JSON through
  `jsonValueToNode`, validates storage shape, hashes via the trusted minimal
  hasher, compares `expectedBlueId` when supplied, and only resolves the runtime
  view if `materialize: 'eager'` or when `resolvedRoot` is first read.
- `loadSnapshotFromMinimal(..., trust: 'trusted-minimal')` may accept a supplied
  `expectedBlueId` as the initial `snapshot.blueId`, but must keep a way to
  verify it in tests/debug mode. This path exists for data that was just written
  by this runtime or is trusted by the storage layer.
- `loadSnapshotFromCache(...)` may use an optional serialized resolved sidecar
  as a non-authoritative acceleration. The minimal overlay plus `blueId` remain
  authoritative. A resolved sidecar must never override the minimal root.
- Public `Blue.calculateBlueId*` remains semantic and safe. Do not make it skip
  resolution for arbitrary minimal-looking authoring input. Put fast paths
  behind explicit trusted/verified storage APIs or snapshot APIs.

### Serialization / Storage Round Trip

Snapshot serialization must interoperate with the current storage boundary:

```ts
const json = nodeToJsonValue(snapshot.toMinimal()); // or Blue.nodeToJson(...)
const rehydrated = blue.jsonValueToNode(json);
const loaded = blue.loadSnapshotFromMinimal(rehydrated, {
  expectedBlueId: snapshot.blueId,
  trust: 'verify',
  materialize: 'lazy',
});
```

Required rules:

- Do not serialize `snapshot.blueId` as a node's own `blueId` field. A node
  `blueId` remains only a reference. Store root identity in an envelope/sidecar,
  e.g. `{ blueId, minimal }`.
- Do not serialize hash caches, path indexes, provider metadata, or frozen-node
  implementation details into Blue content. Store them only as sidecar metadata
  if needed.
- Rehydrating persisted minimal JSON through `jsonValueToNode` must be
  idempotent for semantic identity. If preprocessing rewrites aliases or infers
  types, it must not change the resulting semantic BlueId.
- `StorageShapeValidator` remains the gate for minimal storage input. Mixed
  `blueId + payload`, internal `properties`, invalid list controls, and payload
  kind conflicts still fail before trusted hashing.
- `snapshot.toMinimal()` must return a normal `BlueNode` minimal overlay that can
  be passed through existing `nodeToJsonValue` / `Blue.nodeToJson(...)` and then
  through `jsonValueToNode` without losing list controls, pure references,
  `this#k` final references, or empty-list semantics.

### Implementation

Add:

- `src/lib/snapshot/ResolvedSnapshot.ts`;
- `src/lib/snapshot/FrozenNode.ts` or equivalent;
- `src/lib/snapshot/SnapshotLoader.ts` for trusted/verified minimal load;
- `src/lib/snapshot/SnapshotEditor.ts` for path-local updates;
- `Blue.resolveToSnapshot(...)`;
- `Blue.loadSnapshotFromMinimal(...)` or equivalent;
- `blue.minimize(snapshot)` / `snapshot.toMinimal()`;
- `snapshot.blueId`;
- path index and node-at-pointer helpers.

Minimum functionality:

- immutable resolved root when materialized;
- first-class minimal root;
- lazy resolved-root materialization from minimal storage;
- lazy minimal JSON cache;
- lazy semantic BlueId / trusted-minimal hash cache;
- path index for resolved and/or minimal nodes;
- per-node hash cache on frozen minimal nodes;
- no full-tree mutation after freeze;
- compatibility bridge from existing mutable `ResolvedBlueNode` where needed.

Target variant:

- `SnapshotEditor` or `blue.applyPatch(snapshot, patch)`:
  - copy-on-write only along the changed minimal/resolved path;
  - recompute only touched subtree + ancestors;
  - update minimal overlay and resolved view consistently;
  - return a new snapshot and leave the old snapshot unchanged;
  - expose counters in debug/benchmark mode: copied nodes, recomputed hashes,
    materialized nodes, provider fetches, and full-resolve fallbacks.

This should become the base for later `document-processor` usage.

### Files

- new `src/lib/snapshot/*`;
- adapt `Blue.ts`;
- adapt `SemanticIdentityService` only enough to reuse trusted minimal hashing
  internally without making public `calculateBlueId*` unsafe;
- possible simplification of `ResolvedNode.ts` after snapshot APIs exist;
- tests under `src/lib/snapshot/__tests__/*` plus identity contract coverage.

### Tests

Snapshot core:

- old snapshot does not change after patch;
- new snapshot gets a new semantic `BlueId`;
- only the path to root is copied/rehashed for simple leaf patch;
- `snapshot.toMinimal()` gives the same result as `blue.minimize(resolvedNode)`;
- `resolveToSnapshot()` and ordinary `resolve()` are semantically equivalent;
- `snapshot.blueId === blue.calculateBlueIdSync(snapshot.resolvedRoot)`;
- `snapshot.blueId === trustedHash(snapshot.toMinimal())` through internal API.

Storage round-trip:

- `snapshot.toMinimal() -> nodeToJsonValue/Blue.nodeToJson -> jsonValueToNode -> loadSnapshotFromMinimal(...verify)` preserves `blueId`;
- same round-trip preserves empty lists, `$empty`, `$previous`, `$pos` after
  normalization, pure references, and `MASTER#i` references;
- no snapshot metadata or computed identity appears inside the serialized Blue
  node;
- mixed `blueId + payload` still fails when loaded as minimal storage;
- `jsonValueToNode` preprocessing is idempotent for stored minimal overlays.

Trusted/verified load:

- trusted minimal load can produce `snapshot.blueId` without resolving;
- verified minimal load detects mismatched `expectedBlueId`;
- lazy materialization resolves only when `resolvedRoot` or `nodeAt` needs it;
- resolved sidecar cache is ignored or rejected when it does not match the
  minimal root / expected BlueId.

### Benchmarks

Replace `snapshot-patch` placeholder with real snapshot benchmarks:

- full resolve after patch baseline;
- `resolveToSnapshot(authoring)`;
- `loadSnapshotFromMinimal(...trusted-minimal, materialize: 'lazy')`;
- `loadSnapshotFromMinimal(...verify, materialize: 'lazy')`;
- `loadSnapshotFromMinimal(...verify, materialize: 'eager')`;
- leaf patch on snapshot;
- no-op patch where effective resolved value is unchanged;
- append-only list patch with valid `$previous` / list-fold cache;
- inherited-field override patch;
- patch that forces generalization, if Phase 4 implementation is already in
  the benchmark branch.

Each benchmark should record time plus structural counters: clone/copy count,
recomputed hash count, resolved/materialized node count, provider fetch count,
and whether a full resolve/minimize fallback occurred.

### Natural PR Split

- PR-3A: frozen node + `ResolvedSnapshot` core + compatibility bridge;
- PR-3B: minimal storage loader, trusted/verified load modes, serialization
  round-trip tests;
- PR-3C: lazy caches, path index, `nodeAt` helpers;
- PR-3D: path-local patch/update API + benchmark replacement.

## Phase 4 - Snapshot Patch, Generalization, DP Integration, Final Cleanup

### Goal

Make snapshots the practical runtime model for `document-processor`, and close
what the research called Patch + Generalization + Incremental Update. Final
cleanup should happen after this, not instead of it.

Phase 4 should leave the codebase with no need to infer dynamic generalization
rules from `blue-language-spec-review.md`.

### Implementation

#### 4A. Snapshot patch semantics

`SnapshotEditor` / `blue.applyPatch(snapshot, patch)` must update both:

- the frozen resolved runtime view; and
- the minimal overlay that will be persisted and hashed.

Rules:

- Normalize patch op names used by current DP (`ADD`, `REPLACE`, `REMOVE`) and
  language utilities (`add`, `replace`, `remove`).
- Document root replacement policy explicitly. If root replacement remains
  unsupported, tests must assert it.
- `REPLACE` existing path updates the override.
- `REPLACE` missing path is either an error or treated as `ADD`; pick one and
  document it.
- `ADD` missing path creates an override.
- `ADD` existing path is either an error or treated as `REPLACE`; pick one and
  document it.
- `REMOVE` existing overridden path removes the override; if an inherited value
  exists underneath, the effective resolved value reappears.
- `REMOVE` missing path is either no-op or error; pick one and document it.
- A patch whose new effective value is semantically equal to the current
  effective resolved value is a no-op and must not create a redundant minimal
  override.
- If an override becomes equal to inherited value after a patch, remove it from
  minimal overlay immediately.
- Compare effective equality by semantic hash or normalized content, not object
  identity.

#### 4B. Type mutation and generalization

Patch attempts under `/.../type/*` are forbidden. A patch may replace
`/.../type` only when it is an explicit generalization direction already allowed
by the type chain.

When a patch violates current type invariants:

1. Apply the patch to a tentative persistent copy.
2. Validate the deepest modified node against fixed values, schema constraints,
   type compatibility, item/key/value type compatibility, and list policy.
3. If invalid, climb the current type chain until the node conforms.
4. Update the minimal overlay's `type` reference to the selected generalized
   type.
5. Re-validate the parent, then repeat upward to the root.
6. If no conforming type exists or parent obligations still fail, reject the
   patch and keep the original snapshot unchanged.
7. Recompute only touched hashes and ancestors.

The minimal overlay must reflect the result:

- store new override values only where they differ from inherited state;
- remove redundant overrides immediately;
- replace type references only when the snapshot truly generalized;
- preserve instance-level name/description;
- never remove instance-fixed values that are not derivable from the type chain.

#### 4C. Lists

Implement list patch behavior against the already-finished list-control rules:

- append-only lists allow appends and reject edits/removals/reorders of the
  inherited prefix;
- positional lists allow `$pos` refinement of inherited indices and appends
  after overlays;
- duplicate/out-of-range `$pos` fails;
- malformed or non-first `$previous` fails;
- `$empty: true` remains content;
- append-only list patches should use the list fold / `$previous` cache so
  append can be `O(delta)` when the prefix is valid;
- replace/remove in the middle may be `O(n)` initially unless a later Merkle-list
  optimization is added, but this must be explicit in docs and benchmarks.

#### 4D. Document processor integration

Migrate `document-processor` so runtime mutation goes through snapshots:

- `DocumentProcessingRuntime` holds a `ResolvedSnapshot` or snapshot-backed
  working document, not only a mutable `BlueNode` root;
- `document()` / `documentAt()` remain compatibility APIs but return clones or
  read-only views, never mutable shared snapshot internals;
- `applyPatch` returns before/after values and cascade scopes as today, but the
  committed state is a new snapshot;
- `directWrite` is either mapped to snapshot patch semantics or explicitly kept
  as a legacy/test-only bridge scheduled for removal;
- gas accounting for document snapshots should charge against serialized
  minimal or resolved view consistently and document which one is used;
- emitted events and checkpoint data that serialize nodes through
  `nodeToJsonValue`/`Blue.nodeToJson(...)` must rehydrate through
  `jsonValueToNode` and load through snapshot APIs without losing BlueId.

#### 4E. Transport / webhook shape

If runtime output currently expands huge resolved graphs, switch transport to a
minimal-first envelope:

```ts
{
  rootBlueId: string;
  minimal: JsonBlueValue;
  bundle?: Record<string, JsonBlueValue>;
  blueIdsByPointer?: Record<string, string>;
  resolved?: JsonBlueValue; // debug only, off by default
}
```

Rules:

- `minimal` is the persisted/verifiable content;
- `bundle` contains referenced nodes needed by consumers;
- `resolved` is never authoritative and should be debug-only;
- root identity is stored in the envelope, not as the node's own `blueId`.

#### 4F. Final cleanup

Only after snapshot patch/generalization and DP integration:

- remove legacy list marker code path;
- remove old implicit shortcuts;
- remove or quarantine mutable patch paths that bypass snapshot semantics;
- remove remaining normal-path uses of raw `BlueIdCalculator` in DP/runtime;
- finalize docs and benchmark gates.

### Tests

Patch/generalization case coverage:

- patch target exists vs missing for ADD/REPLACE/REMOVE;
- no-op patch when effective resolved value is unchanged;
- inherited field patched to same value does not create override;
- inherited field patched to different value creates minimal override;
- overridden field patched back to inherited value removes override;
- fixed-value invariant violation triggers valid generalization or fails;
- schema violation triggers valid generalization or fails;
- parent obligations are revalidated after child generalization;
- `/type/*` mutation is rejected;
- `/type` replacement only allows documented generalization direction;
- append-only list append succeeds and uses local hash/list fold path;
- append-only prefix edit/remove/reorder fails;
- positional `$pos` refinement succeeds and duplicate/out-of-range fails;
- middle list replacement/removal behavior is documented and tested;
- old snapshot remains unchanged after every accepted and rejected patch.

DP integration tests:

- `DocumentProcessingRuntime.applyPatch` commits a new snapshot;
- `documentAt()` returns a clone/read-only value and cannot mutate committed
  state;
- before/after patch results match current DP behavior;
- emitted/checkpointed nodes serialize through `nodeToJsonValue`/`Blue.nodeToJson(...)`,
  rehydrate through `jsonValueToNode`, and preserve snapshot BlueId when loaded;
- huge resolved payloads are not emitted unless debug `resolved` output is
  explicitly enabled.

### Benchmarks

- snapshot patch vs full resolve for leaf object path;
- inherited-field no-op patch;
- inherited-field override patch;
- override removal patch;
- valid generalization patch;
- failed generalization rollback;
- append-only list append with valid `$previous`;
- positional list `$pos` patch;
- DP `applyPatch` end-to-end with snapshot state.

### Phase 4 Exit Criteria

- `document-processor` can run on snapshot-backed state without mutable shared
  resolved trees.
- Snapshot patching maintains minimal overlay, resolved view, and semantic
  BlueId consistently.
- Generalization behavior is implemented, tested, and documented.
- Stored minimal JSON round-trips through `nodeToJsonValue`/`Blue.nodeToJson(...)`
  and `jsonValueToNode` into snapshot load without semantic BlueId drift.
- Public semantic `Blue.calculateBlueId*` remains safe and does not silently
  trust arbitrary minimal-looking authoring input.
- Trusted/verified snapshot load paths are available for database/provider
  reads that are already minimal-first.
- `libs/language` and relevant `document-processor` tests pass.
- Snapshot benchmarks prove local rehash/update behavior and no uncontrolled
  full-resolve fallback on the main patch paths.

### Natural PR Split

- PR-4A: snapshot patch semantics and case coverage;
- PR-4B: type generalization algorithm;
- PR-4C: list patch/hash integration;
- PR-4D: document-processor snapshot-backed runtime;
- PR-4E: transport envelope + final cleanup docs.

## 4. Integration Test Examples

### 1) Semantic `BlueId` Is The Same For Authoring / Resolved / Minimal / Provider Fetch

```ts
it('keeps one semantic BlueId across authoring, resolved, minimal and fetched storage form', () => {
  const provider = new BasicNodeProvider();
  provider.addSingleDocs(`
name: BaseType
a: 1
b: 2
`);

  const baseId = provider.getBlueIdByName('BaseType');
  const blue = new Blue({ nodeProvider: provider });

  const authoring = blue.yamlToNode(`
name: Child
type:
  blueId: ${baseId}
c: 3
`);

  const resolved = blue.resolve(authoring);
  const minimal = blue.minimize(resolved);

  const id1 = blue.calculateBlueIdSync(authoring);
  const id2 = blue.calculateBlueIdSync(resolved);
  const id3 = blue.calculateBlueIdSync(minimal);

  expect(id1).toBe(id2);
  expect(id2).toBe(id3);

  provider.addNode(minimal);
  const fetched = provider.fetchByBlueId(id1)![0];

  expect(blue.calculateBlueIdSync(fetched)).toBe(id1);
  expect(blue.calculateBlueIdSync(blue.resolve(fetched))).toBe(id1);
});
```

### 2) Authoring/Storage Ingest Rejects Mixed `blueId + payload`

```ts
it('rejects ambiguous blueId + payload in storage ingest', () => {
  const provider = new BasicNodeProvider();

  expect(() =>
    provider.addSingleDocs(`
name: BadDoc
x:
  blueId: SomeBlueId
  value: 1
`),
  ).toThrow(/ambiguous blueId/i);
});
```

### 3) Snapshot Is Immutable And Performs Path-Local Rehash

```ts
it('creates a new immutable snapshot and rehashes only the touched path', () => {
  const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

  const snap1 = blue.resolveToSnapshot(
    blue.yamlToNode(`
order:
  price: 10
  status: created
`),
  );

  const result = blue.applyPatch(snap1, {
    op: 'replace',
    path: '/order/price',
    value: 11,
  });

  const snap2 = result.snapshot;

  expect(snap2.blueId).not.toBe(snap1.blueId);
  expect(blue.get(snap1.resolvedRoot, '/order/price')?.getValue()).toBe(10);
  expect(blue.get(snap2.resolvedRoot, '/order/price')?.getValue()).toBe(11);

  expect(result.metrics.rehashedPointers).toEqual(['/order/price', '/order', '/']);
});
```

### 4) `$previous` Gives The Same `BlueId` As Full Materialization

```ts
it('gives the same BlueId for append-only list via $previous and full list', () => {
  const blue = new Blue({ nodeProvider: new BasicNodeProvider() });

  const parent = blue.yamlToNode(`
entries:
  type: List
  mergePolicy: append-only
  items: [A, B]
`);

  const prevId = blue.calculateBlueIdSync((blue.get(parent, '/entries') as BlueNode).getItems() ?? []);

  const delta = blue.yamlToNode(`
entries:
  type: List
  mergePolicy: append-only
  items:
    - $previous: { blueId: ${prevId} }
    - C
`);

  const full = blue.yamlToNode(`
entries:
  type: List
  mergePolicy: append-only
  items: [A, B, C]
`);

  expect(blue.calculateBlueIdSync(delta)).toBe(blue.calculateBlueIdSync(full));
});
```

### 5) `this#k` Gives A Stable Combined BlueId For Direct Cycles

```ts
it('assigns stable MASTER#i BlueIds for a direct cyclic set', () => {
  const provider = new BasicNodeProvider();
  const blue = new Blue({ nodeProvider: provider });

  provider.addSingleDocs(`
- name: Person
  pet:
    type: { blueId: this#1 }

- name: Dog
  owner:
    type: { blueId: this#0 }
  breed:
    type: Text
`);

  const personId = provider.getBlueIdByName('Person');
  const dogId = provider.getBlueIdByName('Dog');
  const person = provider.fetchByBlueId(personId)![0];

  expect(personId.split('#')[0]).toBe(dogId.split('#')[0]);
  expect(personId).toMatch(/#1$|#0$/);
  expect(dogId).toMatch(/#1$|#0$/);
  expect(person.get('/pet/type/blueId')).toBe(dogId);
  expect(blue.calculateBlueIdSync({ blueId: personId })).toBe(personId);
});
```

`provider.getNodeByName('Person')` returns a materialized document without the
source `MASTER#i` metadata; standalone `calculateBlueIdSync()` on that node
calculates the ordinary semantic ID for that materialized shape.

## 5. Hard Definition Of Done

### Phase 1 Exit DoD

- `Blue.calculateBlueId*` returns the same result for authoring, resolved, and
  minimal forms for non-cyclic documents, including spec-native list control
  forms.
- `PathLimits` do not change `BlueId`.
- expansion does not change `BlueId`.
- pure-ref short-circuit works only for exact `{ blueId }`.
- `[] != absent`, `[A] != A`, `[[A,B],C] != [A,B,C]`.
- providers store minimal overlay keyed by semantic `BlueId`.
- normal provider/storage path does not use `minimizeStorageOverlay` or legacy
  inherited-list marker.
- `Blue.extend()` / `NodeExtender` expansion preserves semantic `BlueId` and
  does not leave `blueId + payload` as hash input.
- `document-processor` runtime does not fallback to raw `BlueIdCalculator`.
- storage ingest rejects mixed `blueId + payload` as authoring/minimal input.
- `NodeToMapListOrValue` is no longer part of the normal hash path.
  These conditions directly match Sections 8-10 and 12; direct cyclic sets are
  closed in Phase 2 before snapshots. ([language.blue][1])

### Phase 2 Exit DoD

- `Blue.calculateBlueId*(nodes[])` returns `MASTER` for direct cyclic sets.
- providers store the sorted cyclic set under `MASTER`.
- `fetchByBlueId("MASTER#i")` resolves `this#k` to final `MASTER#k`.
- ordinary strings `this` / `this#k` outside `blueId` fields remain content.
- malformed and out-of-range `this#k` are rejected.

### Phase 3 Exit DoD

- `resolveToSnapshot()` exists and returns an immutable/frozen runtime artifact.
- `snapshot.toMinimal()` and `blue.minimize(resolved)` are semantically
  equivalent.
- `snapshot.blueId` is a semantic `BlueId`.
- path patching does not perform full-tree re-resolve.
- `snapshot-patch` benchmark shows local rehash instead of a full pass.
- the old snapshot never changes after committing a new one.
  This is consistent with resolve ending in a finalized snapshot and limits not
  affecting identity. ([language.blue][1])

### Final DoD For `libs/language`

- `canonical` is not used for minimal overlay form; terminology in code and
  docs is consistent.
- official/wrapped form, minimal overlay form, resolved snapshot, and semantic
  `BlueId` are unambiguously separated.
- providers and `NodeContentHandler` operate on minimal-first storage.
- `Merger` / minimizer / hasher support `$previous`, `$pos`, `$empty`.
- write path does not emit legacy list marker.
- direct cyclic sets support `this#k`, MASTER, and final `MASTER#i`.
- `nx test language` passes in full.
- `calculate-blue-id` and `resolve` benchmarks have no regression above 10%
  against the general baseline.
- append-only list case is clearly faster than baseline.
- README, `docs/blue-id.md`, `docs/resolve.md`, ADRs, and glossary match the
  new semantics.
  This closes full conformance with the current specification for identity,
  minimization, list hashing, and direct cycles. ([language.blue][1])

The remaining direction is: first keep identity, storage, and direct cyclic
`BlueId` stable; then add runtime snapshots for `document-processor`.

## 6. Follow-Up Improvements

These are not required to prove Phase 3/4 correctness, but they are the most
likely performance wins and repository ergonomics follow-ups after semantic
identity is correct.

### 6.1 Snapshot / Storage Performance Follow-Ups

1. **Trusted minimal hash / load API.** Add an explicit API for content that was
   already persisted as minimal overlay by this runtime. It should validate
   storage shape and use the trusted minimal hasher instead of public
   `calculateBlueId*`, which intentionally resolves and minimizes arbitrary
   authoring input.
2. **Minimal-only snapshot mode.** Allow database/provider reads to create a
   snapshot with `minimalRoot` and `blueId` immediately, while materializing
   `resolvedRoot` lazily. This helps code paths that only need identity,
   transport, or storage verification.
3. **Resolved sidecar cache.** Optionally persist a resolved view beside the
   minimal overlay as a non-authoritative cache. On read, rehydrate both through
   `jsonValueToNode`; verify against the minimal root / expected BlueId when
   requested; never let the sidecar change identity.
4. **Provider-resolved type interning.** Cache frozen resolved type snapshots by
   semantic BlueId/provider version. This targets the `resolve(shared)` win and
   should reduce both time and allocations for repeated repository types.
5. **Unique-type resolver counters.** Add benchmark counters for provider
   fetches, type-chain resolutions, overlay merges, minimizer visits, and hash
   recomputations. The `resolve(unique)` case has fewer clones but is still
   slower, so clone count alone is not enough.
6. **Incremental minimization.** During patching, update minimal overlay locally:
   create overrides only when values differ from inherited state and remove
   overrides as soon as they become redundant. Avoid full-tree minimization in
   the normal patch path.
7. **Append-only list fold cache.** Store list fold state in frozen list nodes so
   valid appends can hash only the appended suffix. The serialized minimal node
   must still round-trip through `nodeToJsonValue`/`Blue.nodeToJson(...)` and
   `jsonValueToNode`; fold state is cache metadata, not Blue content.
8. **Snapshot serialization envelope.** Standardize a storage envelope such as
   `{ blueId, minimal, resolvedCache?, meta? }`. Only `minimal` is Blue content;
   `blueId`, caches, and provider metadata are sidecars.
9. **Benchmark trusted storage paths separately.** Add benchmark rows for:
   public semantic authoring, trusted minimal hash, verified minimal load, lazy
   snapshot load, eager snapshot load, and cached resolved sidecar load. This
   will make the current semantic BlueId regressions easier to interpret.
10. **Debug drift detector.** In development/test mode, occasionally recompute
    `blue.calculateBlueIdSync(snapshot.resolvedRoot)` and compare it with
    `snapshot.blueId` to catch cache bugs without putting full recomputation on
    the hot path.

### 6.2 Repository Generator Direct Cyclic Source Files

Status: planned.

`repository-generator` still needs source-file support for top-level direct
cyclic document sets. Runtime repositories can already store
`contents[MASTER] = [...]`, and `RepositoryBasedNodeProvider` canonicalizes
those arrays before indexing `MASTER#i` references. The missing piece is the
generator input path: discovery currently rejects `.blue` files whose top-level
YAML value is an array because it expects a single object with `name`.

Reference behavior:

- `libs/language/src/lib/provider/__tests__/RepositoryBasedNodeProvider.test.ts`
  has the runtime/provider regression case
  `canonicalizes direct cyclic document sets before indexing # references`.
  That test demonstrates the shape generator output should eventually produce:
  one array-backed repository content entry keyed by `MASTER`, with aliases
  resolving to canonical `MASTER#i` members after cyclic-set ordering.

Implementation notes:

- parse top-level arrays as one logical storage unit;
- calculate `MASTER` through `Blue.calculateBlueIdSync(nodes[])`;
- store the canonicalized/sorted array under `MASTER`;
- expose named members as aliases like `Package/MemberName -> MASTER#i` after
  canonicalization, not by the original authoring order;
- update metadata, versioning, contract validation, and diff handling so
  array-backed content is valid generator output and does not require each
  member document to be emitted under an independent storage key.

Acceptance:

- `repository-generator` accepts a `.blue` file whose top-level YAML is a
  direct cyclic document-set array;
- generated repository content emits `contents[MASTER] = [...]`;
- each named member alias maps to the canonical `MASTER#i` index;
- regenerated output loads through `RepositoryBasedNodeProvider` and preserves
  direct cycle lookup by both `MASTER#i` and generated aliases.

[1]: https://language.blue/docs/reference/specification 'Blue Language Specification - language.blue docs'
