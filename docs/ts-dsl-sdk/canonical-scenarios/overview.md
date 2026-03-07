# BLUE TS DSL SDK — Canonical scenario corpus

This folder defines the public, self-contained acceptance corpus for complex DSL-authored documents.

The purpose is not to test transport, persistence internals, bootstrap endpoints, or `initMode` / `LATE_START`. The purpose is to prove that the TypeScript DSL can generate the same authored BLUE documents and the same runtime-visible behavior as the canonical scenarios documented in this repository.

## Source-of-truth order for complex scenarios

1. The canonical scenario docs in this folder
2. `final-dsl-sdk-mapping-reference.md`
3. `complex-flow-materialization-reference.md`
4. Java SDK examples only as secondary ergonomics reference

## Included vs excluded

Included:
- authored documents represented directly in the canonical scenario docs
- runtime-visible workflow behavior driven by those documents
- multi-workflow permission, subscription, agency, provider, and paynote flows

Excluded:
- REST/API transport tests
- endpoint contract tests
- persistence or idempotency semantics that do not change authored document shape
- `initMode` / `LATE_START`
- malformed payload tests that intentionally bypass normal authored-document generation

See `exclusions.md` for the explicit list.

## How to use the corpus

For every selected scenario:
1. rebuild the canonical authored document with the DSL SDK,
2. compare canonical-vs-DSL shape after preprocess using `official` JSON and BlueId,
3. rerun the scenario with the DSL-authored document,
4. require zero functional drift unless a documented deviation applies.

The DSL test may be more readable than the canonical fixture, but it may not change the document meaning.
