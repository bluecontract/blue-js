# document-processor

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build document-processor` to build the library.

## Running unit tests

Run `nx test document-processor` to execute the unit tests via [Vitest](https://vitest.dev/).

## Performance benchmarks

Run `nx run document-processor:bench` to execute the Document Processor benchmarks.
In CI, run the same target to fail the build when regressions exceed the configured threshold.

Benchmarks compare against `libs/document-processor/src/__bench__/benchmarks.baseline.json` and write
the latest run to `tmp/document-processor.bench.json`. To update the baseline after a verified
performance change, run:

```
BENCHMARK_UPDATE_BASELINE=1 nx run document-processor:bench
```

To adjust the regression threshold (default 10%), set `BENCHMARK_REGRESSION_THRESHOLD` (e.g. `0.05`
for 5%).

## Memory checks

Run `nx run document-processor:memcheck` to execute the optional heap growth check (requires
`NODE_OPTIONS=--expose-gc`, already set in the target).

Tuning knobs (defaults shown):
- `MEMCHECK_WARMUP=3`
- `MEMCHECK_ITERATIONS=100`
- `MEMCHECK_MAX_DELTA_RATIO=0.1`
- `MEMCHECK_MAX_DELTA_BYTES=5242880`
- `MEMCHECK_TIMEOUT_MS=300000`
- `MEMCHECK_SNAPSHOTS=0` (set to `1` to write heap snapshots)
- `MEMCHECK_SNAPSHOTS_DIR=../../tmp/document-processor-memcheck`
- `MEMCHECK_RSS_MAX_DELTA_BYTES` (optional RSS growth cap)
- `MEMCHECK_WASM_MAX_DELTA_BYTES` (optional ArrayBuffer/WASM growth cap)
- `MEMCHECK_FIXTURE=quiz` (or `counter`, `all`; use `MEMCHECK_FIXTURES=quiz,counter`)
- `MEMCHECK_BACKEND_MODE=0` (set to `1` to default to backend-style processing)
- `MEMCHECK_USE_REPOSITORY_BLUE=0` (set to `1` to use repo-only `Blue`)
- `MEMCHECK_NEW_PROCESSOR=0` (set to `1` to create a processor per iteration)
- `MEMCHECK_NEW_BLUE=0` (set to `1` to create a `Blue` per iteration)
- `MEMCHECK_RESOLVE_DOCUMENT=0`
- `MEMCHECK_RESOLVE_EVENT=0`
- `MEMCHECK_CONCURRENCY=1`
