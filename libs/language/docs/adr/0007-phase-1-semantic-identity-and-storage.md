### ADR 0007: Phase 1 semantic identity and minimal-first storage

**Status:** Accepted for phase 1 implementation.

**Context**

ADR 0001 through ADR 0006 define the direction for identity, minimization,
storage, snapshots, list controls, and cyclic sets. Phase 1 turns the identity
and storage decisions into runtime behavior. Phase 1K brings spec-native list
controls forward before snapshots; Phase 2 adds top-level direct cyclic
`this#k` document-set identities.

**Decision**

Public `Blue.calculateBlueId*` APIs mean semantic BlueId. They resolve normal
authoring or official input, minimize the resolved tree, and hash the minimal
overlay. Exact pure references still return their referenced BlueId.

`BlueIdCalculator` remains the low-level Section 8 hasher. It hashes a provided
shape directly and does not perform provider-backed resolution.

Provider storage is minimal-first. Providers parse and preprocess input, reject
ambiguous storage shapes, compute the stored content BlueId, and persist minimal
overlay content under that BlueId.

`providedBlueId` validation is strict everywhere, including repository-backed
providers. If supplied content computes to a different BlueId, provider loading
fails instead of storing aliases or dual keys.

The model field named `blueId` is a reference BlueId, not a node's own computed
identity. New code should use `getReferenceBlueId()` and
`setReferenceBlueId()`; existing `getBlueId()` and `setBlueId()` remain
compatibility aliases during migration.

**Consequences**

Existing repository or storage fixtures with IDs computed by older algorithms
must be regenerated. Mixed `blueId` plus payload is rejected on authoring and
storage ingest, but internal materialized runtime trees may still temporarily
carry a reference BlueId beside fetched payload and are minimized before
semantic hashing.

List overlays use spec-native `$previous`, `$pos`, and `$empty` after Phase 1K.
Single-document `this` references remain unsupported, while Phase 2 handles
top-level direct cyclic document sets with final `MASTER#i` identities.
