### ADR 0006: Spec-native list controls and direct cycles

**Status:** Accepted for phase 0 guardrails.

**Context**

The specification defines list controls `$previous`, `$pos`, `$empty`, and
direct cyclic-set identities using `this#k`, a master BlueId, and final
`MASTER#i` document identities.

**Decision**

List controls and direct cyclic identities are the final conformance phase.
Write paths should stop emitting legacy inherited-list markers once `$previous`
and `$pos` are implemented. Direct cycles should use the specification's ZERO
sentinel, preliminary ids, lexicographic sorting, `this#k` rewrite, master list
hash, and final `MASTER#i` ids.

**Consequences**

Phase 0 records the decision and adds fixtures. Runtime behavior is not changed
until phase 3.
