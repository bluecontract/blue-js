### Identity glossary

This glossary fixes the terms used by the identity, minimization, storage, and
snapshot work. The normative source is the Blue language specification in
`/Users/mjonak/www-apps/work/Blue/language-blue/content/spec.md`, especially
sections 8 through 12.

**official / wrapped form**

The specification's official canonical representation. Scalars are represented
as `{ value: ... }`, lists as `{ items: [...] }`, and object nodes as plain maps
of field names to nodes. Use `canonical` only for this wrapped shape or for RFC
8785 canonical JSON.

**authoring sugar**

The shorter input form authors can write before preprocessing and hashing, such
as `x: 1` or `x: [a, b]`. Hashing must treat authoring sugar as equivalent to
the corresponding official wrapped form.

**minimal overlay**

A minimal authoring view that preserves the same resolved snapshot and the same
semantic BlueId when it is resolved again. It removes content that is fully
derivable from the type chain and keeps instance-level content.

**resolved tree**

The current runtime tree produced by `resolve()`. In the current implementation
this is represented by `ResolvedBlueNode`. It is mutable today and is distinct
from the future frozen snapshot artifact.

**resolved snapshot**

A finalized, immutable resolved runtime artifact. The specification recommends
freezing resolved snapshots; the phase 2 implementation will make this explicit
and cache derived values such as minimal overlay and semantic BlueId.

**semantic BlueId**

The public content identity for a Blue node. It is stable across equivalent
authoring, official, minimal, expanded, and resolved forms. Public
`Blue.calculateBlueId*` APIs should converge on this meaning.

**referenceBlueId**

The BlueId stored in a node's `blueId` field when the node references another
node. It is not the node's own computed identity. Existing `getBlueId()` and
`setBlueId()` names are legacy model names for this reference field.

**expansion**

Materializing content referenced by `{ blueId: ... }` through a provider.
Expansion limits affect how much content is materialized, but must not affect
semantic BlueId.

**minimization**

Normalizing a resolved snapshot or resolved tree back to a minimal overlay.
Minimization must preserve the resolved snapshot semantics and semantic BlueId.
