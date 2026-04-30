# Benchmarks

`libs/language` keeps benchmark scripts under `scripts/benchmark`. They are
small, deterministic scenarios used to track resolver, BlueId, and future
snapshot performance. Treat exact timings as machine-local: compare runs only
when the machine, Node runtime, benchmark config, and build mode are the same.

Before running benchmarks from the repo root, build the package through the Nx
targets below. They depend on `language:build` where needed.

```bash
npx nx run language:benchmark:calculate-blue-id
npx nx run language:benchmark:semantic-blue-id
npx nx run language:benchmark:resolve
npx nx run language:benchmark:resolve:unique
npx nx run language:benchmark:snapshot-patch
```

The `benchmark:calculate-blue-id` target also regenerates the large test data
fixture before running. If `clinic` is installed on the PATH, that target runs
through `clinic flame`; for plain timing output, run the script directly from
`libs/language` after building and generating the fixture.

## Scenarios

### Low-level BlueId hash

`calculateBlueId.mjs` measures `BlueIdCalculator.calculateBlueId(...)` over a
large generated `BlueNode` tree. The fixture is produced by
`generateData.mjs`, which writes a synthetic company-like object with nested
departments, employees, projects, tasks, campaigns, locations, and facilities.

This benchmark tracks the low-level Section 8 hashing path. It is intentionally
separate from public semantic identity, which uses `Blue.calculateBlueId*` and
may resolve and minimize before hashing.

### Public semantic BlueId

`semanticBlueId.mjs` measures public `Blue.calculateBlueIdSync(...)` scenarios:

- authoring input without a type;
- authoring input with a shared provider-backed type;
- an already resolved node;
- minimal-shaped authoring input through the public semantic API;
- provider ingest for a typed node.

The minimal-shaped scenario does not expose or benchmark a public
trusted-minimal hash API. It still uses the public semantic identity path.

### Resolve

`resolve.mjs` measures `blue.resolve(...)` over deterministic generated input:

- `300` object properties;
- `300` list items;
- `60` properties per type definition;
- `6` payload properties per typed node;
- `2` warmup iterations and `10` measured iterations by default.

The default `shared` mode creates one provider-backed type and points all 600
typed nodes at that type. This is a useful proxy for workloads where many
documents or values use the same repository type, including
`RepositoryBasedNodeProvider` after the provider has been constructed.

The `unique` mode creates 600 distinct type definitions, one per typed node.
This is the weaker reuse case and is expected to benefit less from resolved
type and type-overlay caching.

The benchmark also counts `BlueNode.clone()` and `BlueNode.cloneShallow()`
calls. Total clone count is often more stable than wall-clock timing and helps
explain resolver allocation changes.

### Snapshot patch placeholder

`snapshotPatch.mjs` currently measures patch-then-full-resolve:

1. create a node with `300` object properties and `6` payload fields per
   property;
2. apply one RFC-6902-style replace operation in the middle of the tree;
3. run a full `blue.resolve(...)` on the patched node.

This is not yet a structural snapshot patch benchmark. It is a Phase 3 baseline
for comparing the later path-local snapshot update implementation against the
current full-pass behavior.

## Baselines

Each benchmark can save or compare JSON baseline files. Baselines include the
creation time, benchmark config, and measured metric stats.

```bash
BENCH_SAVE_BASELINE=1 npx nx run language:benchmark:resolve
BENCH_COMPARE_BASELINE=1 npx nx run language:benchmark:resolve
```

Use `BENCH_BASELINE_FILE` to store a baseline outside the checked-in default
path or to compare against a temporary baseline from another branch:

```bash
BENCH_SAVE_BASELINE=1 \
BENCH_BASELINE_FILE=/tmp/blue-main-bench-baselines/resolve-baseline.json \
npx nx run language:benchmark:resolve

BENCH_COMPARE_BASELINE=1 \
BENCH_BASELINE_FILE=/tmp/blue-main-bench-baselines/resolve-baseline.json \
npx nx run language:benchmark:resolve
```

When the current config differs from the baseline config, the script still
prints deltas but warns that the comparison is approximate.

## Configuration

| Variable                        | Used by                            |         Default | Meaning                                                           |
| ------------------------------- | ---------------------------------- | --------------: | ----------------------------------------------------------------- |
| `BENCH_WARMUP_ITERATIONS`       | all                                |             `2` | Unmeasured warmup iterations.                                     |
| `BENCH_ITERATIONS`              | all                                |            `10` | Measured iterations used for min/max/avg.                         |
| `BENCH_SAVE_BASELINE`           | all                                |             off | Save the current result as JSON.                                  |
| `BENCH_COMPARE_BASELINE`        | all                                |             off | Compare the current result with a JSON baseline.                  |
| `BENCH_BASELINE_FILE`           | all                                | script-specific | Override the baseline file path.                                  |
| `BENCH_TYPE_MODE`               | `resolve.mjs`                      |        `shared` | `shared` or `unique` type generation.                             |
| `BENCH_OBJECT_PROPERTIES`       | `resolve.mjs`, `snapshotPatch.mjs` |           `300` | Number of root object properties.                                 |
| `BENCH_LIST_ITEMS`              | `resolve.mjs`                      |           `300` | Number of root list items.                                        |
| `BENCH_TYPE_PROPERTIES`         | `resolve.mjs`                      |            `60` | Number of properties on each type definition.                     |
| `BENCH_NODE_PAYLOAD_PROPERTIES` | `resolve.mjs`, `snapshotPatch.mjs` |             `6` | Number of local fields on each generated node.                    |
| `BENCH_SEMANTIC_PROPERTIES`     | `semanticBlueId.mjs`               |           `120` | Number of authoring properties in the semantic identity fixture.  |
| `BENCH_MAX_REGRESSION_PERCENT`  | `resolve.mjs`                      |            `10` | Maximum allowed time regression when comparing resolve baselines. |

## Interpreting results

- Compare runs from the same machine, Node version, branch build mode, and
  benchmark config. Do not compare laptop-local averages with CI or another
  developer machine as a hard performance signal.
- `resolve(shared)` is the main signal for repeated use of the same provider
  type. It should improve when provider fetches, resolved types, or type
  overlays are reused effectively.
- `resolve(unique)` measures the distinct-type path. It is useful as a guard
  against optimizations that help shared types while making unique types too
  expensive.
- The semantic BlueId benchmark on the semantic-identity implementation is not
  equivalent to the historical main branch behavior. The newer path computes
  public semantic identity through resolve/minimize semantics, so authoring and
  provider-ingest scenarios can be slower while being more correct.
