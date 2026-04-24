# BlueId/minimization phase benchmark comparisons (before vs after)

This document records **true before/after measurements** for the implemented
phases, using identical benchmark input and harness logic across milestone
boundary commits.

## Benchmark harness

- Script: `libs/language/scripts/benchmark/phaseHarness.mjs`
- Result artifacts:
  - `libs/language/scripts/benchmark/data/phase-comparisons/phase0-before-m1.json`
  - `libs/language/scripts/benchmark/data/phase-comparisons/phaseA-after-blueid-core.json`
  - `libs/language/scripts/benchmark/data/phase-comparisons/phaseC-after-minimize-api.json`
  - `libs/language/scripts/benchmark/data/phase-comparisons/current-head-phase0-backfill.json`
- Fixed config:
  - warmup: 2 iterations
  - measured: 20 iterations
  - inherited props: 120
  - extra props: 60

Measured metrics:

- `BlueIdCalculator.calculateBlueIdSync(authoring)` avg/p95
- `blue.resolve(authoring)` avg/p95
- `minimize` avg/p95:
  - pre-phase-C: `resolved.getMinimalNode()`
  - phase-C+: `blue.minimizeResolved(resolved)`

## Commit boundaries used

- **Before Milestone 1 / Phase 0 baseline**: `6be9d4c`
- **After Phase A (BlueId core)**: `1b135b3`
- **After Phase C (minimize API)**: `7d23ad1`
- **Current head (phase-0 backfill docs/bench artifacts)**: `1358d3b`

## Results

### Raw measured values (avg ms)

| Commit | blueId avg | resolve avg | minimize avg |
|---|---:|---:|---:|
| `6be9d4c` (before M1) | 1.2173 | 15.2459 | 0.5101 |
| `1b135b3` (after A) | 1.6520 | 15.8301 | 0.3300 |
| `7d23ad1` (after C) | 1.6352 | 15.5828 | 0.4762 |
| `1358d3b` (current) | 1.6495 | 15.3809 | 0.3845 |

### Phase deltas

#### Phase A delta (`6be9d4c` → `1b135b3`)

- BlueId avg: **+35.7%** (`1.2173` → `1.6520`)
- Resolve avg: **+3.8%** (`15.2459` → `15.8301`)
- Minimize avg: **-35.3%** (`0.5101` → `0.3300`)

Interpretation:
- BlueId became slower on this synthetic fixture after canonical path changes.
- Resolve shows small overhead increase.
- Minimize path (still via `getMinimalNode`) measured faster here.

#### Phase C delta (`1b135b3` → `7d23ad1`)

- BlueId avg: **-1.0%** (`1.6520` → `1.6352`)
- Resolve avg: **-1.6%** (`15.8301` → `15.5828`)
- Minimize avg: **+44.3%** (`0.3300` → `0.4762`)

Interpretation:
- BlueId and resolve stayed close / slightly improved.
- Minimize API layer introduces measurable overhead vs direct `getMinimalNode`
  on this harness.

#### Phase-0 backfill delta (`7d23ad1` → `1358d3b`)

- BlueId avg: **+0.9%** (`1.6352` → `1.6495`)
- Resolve avg: **-1.3%** (`15.5828` → `15.3809`)
- Minimize avg: **-19.3%** (`0.4762` → `0.3845`)

Interpretation:
- Backfill changes were docs/scripts only; variations are expected benchmark
  noise and do not indicate runtime behavior change.

## Notes and caveats

- These are single-machine, local micro-benchmarks and should be interpreted as
  directional.
- If stricter confidence is needed, run 5–10 repeated samples per commit and
  aggregate median/CI.
- `invariants.blueIdEqual` is `false` in this harness for all commits and is
  expected for this synthetic fixture shape; this harness is primarily for
  runtime comparison, not semantic equivalence validation.

## Procedure for future phases

For each future phase (e.g. Phase D, B):

1. Run harness at **phase start baseline commit**:
   - `BENCH_COMMIT=<commit> BENCH_OUTPUT_PATH=... node libs/language/scripts/benchmark/phaseHarness.mjs`
2. Run harness at **phase completion commit** with same config.
3. Store both JSON files under:
   - `libs/language/scripts/benchmark/data/phase-comparisons/`
4. Append results + delta interpretation to this document.
