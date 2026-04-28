### ADR 0005: Resolved snapshots

**Status:** Accepted for phase 0 guardrails.

**Context**

The specification describes resolve as producing a finalized resolved snapshot
and recommends freezing it. The current `ResolvedBlueNode` marks a resolved
tree, but it is still a mutable node graph.

**Decision**

Phase 3 should add a `ResolvedSnapshot` runtime artifact with an immutable
resolved root, lazy minimal overlay cache, lazy semantic BlueId cache, path
index, and resolve-context metadata. Patch/update APIs should return a new
snapshot and reuse unchanged subtrees.

**Consequences**

Phase 0 adds benchmark and test placeholders only. No snapshot public API is
introduced in this phase.
