### ADR 0007: Phase 1 semantic identity and minimal-first storage

**Status:** Accepted for phase 1 implementation.

**Context**

ADR 0001 through ADR 0006 define the direction for identity, minimization,
storage, snapshots, list controls, and cyclic sets. Phase 1 turns the identity
and storage decisions into runtime behavior while intentionally leaving
spec-native list controls and direct cyclic `this#k` identities for phase 3.

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

List overlays and direct cycles keep their transitional legacy behavior until
phase 3. Phase 1 must not claim final public storage compatibility for those
families of documents.
