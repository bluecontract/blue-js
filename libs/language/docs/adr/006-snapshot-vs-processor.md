# ADR-006: Snapshot Versus Processor Refactor

## Status

Accepted for Phase 0.

## Context

The specification separates language identity/minimization from runtime contract
processing. Frozen resolved snapshots are useful for processor correctness and
performance, but they are not required before fixing BlueId Core or adding
minimization.

## Decision

Phase A and Phase C will be implemented before the ResolvedSnapshot and
document-processor refactor. The processor remains a consumer in Milestone 1,
covered by smoke tests and call-site inventory only.

## Consequences

The identity/minimization work can land without a broad runtime rewrite. Phase D
will later introduce `ResolvedSnapshot`, immutability guarantees, structural
sharing, and document-processor migration.
