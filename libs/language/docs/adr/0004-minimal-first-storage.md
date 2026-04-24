### ADR 0004: Minimal-first provider storage

**Status:** Accepted for phase 0 guardrails.

**Context**

Providers currently store preprocessed or materialized JSON depending on the
path. The specification ties identity, minimization, and storage together:
minimized content must resolve back to the same snapshot and same semantic
BlueId.

**Decision**

Provider storage should converge on minimal overlay content keyed by semantic
BlueId. If a caller supplies a BlueId for stored content, the provider must
reject it when it differs from the computed semantic BlueId.

**Consequences**

Phase 1 will update `NodeContentHandler`, `BasicNodeProvider`,
`RepositoryBasedNodeProvider`, and `InMemoryNodeProvider`. Phase 0 only adds
fixtures and contract tests.
