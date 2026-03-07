# BLUE TS DSL SDK — Reference scenario suites

These reference suites are the **acceptance corpus for DSL -> document generation** once the SDK moves past small Java parity examples.

## Purpose

The goal is not to test API transport, persistence, bootstrap endpoint internals, or `initMode` / `LATE_START`.
The goal is to test whether the TS DSL can generate **the same authored documents and the same runtime-visible behavior** as real product/runtime scenarios from:

- `lcloud` / MyOS integration tests
- `demo-bank-app` / PayNote business tests

## Source-of-truth order for complex scenarios

1. Real authored documents and flows present in `lcloud` and `demo-bank-app`
2. `final-dsl-sdk-mapping-reference.md`
3. `complex-flow-materialization-reference.md`
4. Java SDK tests/examples, only as secondary parity/ergonomics reference

## Included vs excluded

Included:
- authored documents defined inline in real integration/business tests
- runtime-visible workflow behavior driven by those authored documents
- multi-workflow permission/subscription/agency/provider/paynote flows

Excluded:
- REST/API transport tests
- endpoint contract tests
- persistence/idempotency semantics that do not change authored document shape
- `initMode` / `LATE_START`
- malformed payload tests that intentionally bypass normal authored-document generation

See `exclusions.md` for the explicit list.

## How to use these suites

For every selected scenario:
1. identify the **raw authored document** in the source test or source helper,
2. rebuild it with DSL SDK,
3. compare raw-vs-DSL shape after preprocess / official JSON / BlueId,
4. re-run the scenario with the DSL-built document,
5. require zero functional drift.

The DSL test may be more readable than the source test, but it may not change the document meaning.
