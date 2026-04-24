# Benchmark fixtures and baseline workflow

This directory contains reproducible benchmark tooling used as a baseline for
BlueId/minimization/runtime performance tracking.

## Scripts

- `generateData.mjs` — generates deterministic fixture payloads under
  `scripts/benchmark/data/`
- `calculateBlueId.mjs` — repeated BlueId timing over generated data
- `resolve.mjs` — resolver benchmark with clone counters and optional baseline
  save/compare
- `minimize.mjs` — minimization benchmark (resolve/minimize shape-reduction +
  timing) with optional baseline save/compare

## Recommended phase-0 baseline flow

From repository root:

```bash
npx nx run language:benchmark:generate-data
npx nx run language:benchmark:calculate-blue-id
npx nx run language:benchmark:resolve
npx nx run language:benchmark:resolve:unique
npx nx run language:benchmark:minimize
```

## Saving and comparing baselines

All benchmark scripts support environment-driven baseline persistence:

```bash
# BlueId baseline
BENCH_SAVE_BASELINE=true npx nx run language:benchmark:calculate-blue-id
BENCH_COMPARE_BASELINE=true npx nx run language:benchmark:calculate-blue-id

# save baseline (shared-type mode)
BENCH_SAVE_BASELINE=true npx nx run language:benchmark:resolve

# compare current run with saved baseline
BENCH_COMPARE_BASELINE=true npx nx run language:benchmark:resolve

# unique-type mode baseline
BENCH_TYPE_MODE=unique BENCH_SAVE_BASELINE=true npx nx run language:benchmark:resolve:unique

# minimize baseline
BENCH_SAVE_BASELINE=true npx nx run language:benchmark:minimize
BENCH_COMPARE_BASELINE=true npx nx run language:benchmark:minimize
```

Default baseline files:

- BlueId: `scripts/benchmark/data/calculate-blue-id-baseline.json`
- shared mode: `scripts/benchmark/data/resolve-baseline.json`
- unique mode: `scripts/benchmark/data/resolve-baseline-unique.json`
- minimize: `scripts/benchmark/data/minimize-baseline.json`

## Notes

- Benchmarks are characterization tools, not strict pass/fail gates.
- Keep fixture generation deterministic and checked in where practical to enable
  before/after comparisons across milestones.
