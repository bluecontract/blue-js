### ADR 0006: Spec-native list controls and direct cycles

**Status:** Accepted. List controls implemented in Phase 1K; direct cycles
remain Phase 3.

**Context**

The specification defines list controls `$previous`, `$pos`, `$empty`, and
direct cyclic-set identities using `this#k`, a master BlueId, and final
`MASTER#i` document identities.

**Decision**

List controls moved into Phase 1K before snapshots. Phase 1 no longer emits
legacy inherited-list markers in normal write paths:

- `$previous` anchors inherited append prefixes.
- `$pos` carries positional refinements and is consumed before raw hashing.
- `$empty` remains ordinary content.

Raw hashing can seed the list fold from `$previous` for append-only deltas
because no previous elements need to be inspected. `$pos` replacements require
the previous list contents to build the final list, so semantic identity resolves
them before hashing and does not pass raw `$pos` controls to the low-level
hasher.

Direct cycles should still use the specification's ZERO sentinel, preliminary
ids, lexicographic sorting, `this#k` rewrite, master list hash, and final
`MASTER#i` ids in Phase 3.

**Consequences**

Phase 1 removes the legacy marker from normal write paths and implements
spec-native list controls. Snapshot work can build on final list semantics.
Direct cycles still land in Phase 3.
