### Identity glossary

This glossary fixes the terms used by the identity, minimization, storage, and
snapshot work. The normative source is the Blue language specification in
`https://language.blue/docs/reference/specification`, especially
sections 8 through 12.

**official / wrapped form**

The specification's official canonical representation. Scalars are represented
as `{ value: ... }`, lists as `{ items: [...] }`, and object nodes as plain maps
of field names to nodes. Use `canonical` only for this wrapped shape or for RFC
8785 canonical JSON.

Example:

```yaml
x:
  value: 1
tags:
  items:
    - value: a
    - value: b
```

**authoring sugar**

The shorter input form authors can write before preprocessing and hashing, such
as `x: 1` or `x: [a, b]`. Hashing must treat authoring sugar as equivalent to
the corresponding official wrapped form.

Example equivalent to the wrapped form above:

```yaml
x: 1
tags:
  - a
  - b
```

**minimal overlay**

A minimal authoring view that preserves the same resolved snapshot and the same
semantic BlueId when it is resolved again. It removes content that is fully
derivable from the type chain and keeps instance-level content.

Example type content:

```yaml
name: Person
age:
  type: Integer
country: PL
```

Example instance before minimization:

```yaml
name: Jan
type:
  blueId: PersonTypeBlueId
age: 30
country: PL
```

Minimal overlay:

```yaml
name: Jan
type:
  blueId: PersonTypeBlueId
age: 30
```

The `country: PL` field is omitted because it is fully recoverable from
`PersonTypeBlueId`.

**resolved tree**

The current runtime tree produced by `resolve()`. In the current implementation
this is represented by `ResolvedBlueNode`. It is mutable today and is distinct
from the future frozen snapshot artifact.

Continuing the `Person` example, a resolved tree conceptually contains the
type-derived fields and the instance fields together:

```yaml
name: Jan
type:
  blueId: PersonTypeBlueId
  name: Person
  age:
    type: Integer
  country: PL
age:
  type: Integer
  value: 30
country:
  value: PL
```

This shape is useful for runtime processing, type checks, and path reads. It is
not the preferred storage shape.

**resolved snapshot**

A finalized, immutable resolved runtime artifact. The specification recommends
freezing resolved snapshots; the phase 2 implementation will make this explicit
and cache derived values such as minimal overlay and semantic BlueId.

In phase 1, `ResolvedBlueNode` is the mutable resolved tree. In phase 2, the
same resolved meaning should be exposed as an immutable snapshot: callers can
read it, derive its minimal overlay or semantic BlueId, and apply updates by
creating a new snapshot rather than mutating the existing one.

**semantic BlueId**

The public content identity for a Blue node. It is stable across equivalent
authoring, official, minimal, expanded, and resolved forms. Public
`Blue.calculateBlueId*` APIs use this meaning.

Example:

```ts
const authoring = blue.yamlToNode(input);
const resolved = blue.resolve(authoring);
const minimal = blue.minimize(resolved);

blue.calculateBlueIdSync(authoring) === blue.calculateBlueIdSync(resolved);
blue.calculateBlueIdSync(resolved) === blue.calculateBlueIdSync(minimal);
```

**referenceBlueId**

The BlueId stored in a node's `blueId` field when the node references another
node. It is not the node's own computed identity. Existing `getBlueId()` and
`setBlueId()` names are legacy model names for this reference field;
`getReferenceBlueId()` and `setReferenceBlueId()` are preferred in new code.

Pure reference example:

```yaml
blueId: PersonTypeBlueId
```

For storage, a node's computed semantic BlueId should be stored outside the
node content, such as in a database key or `blue_id` column.

**materialized reference subtree**

A runtime shape where a reference has been expanded with provider content. Type
nodes may preserve the reference BlueId while carrying the expanded payload:

```yaml
type:
  blueId: PersonTypeBlueId
  name: Person
  age:
    type: Integer
```

Ordinary content references usually materialize without preserving the
reference field:

```yaml
owner:
  name: Alice
  email: alice@example.com
```

Storage and authoring input should not combine `blueId + payload`; exact
`{ blueId: ... }` is the reference form.

**expansion**

Materializing content referenced by `{ blueId: ... }` through a provider.
Expansion limits affect how much content is materialized, but must not affect
semantic BlueId.

Example:

```yaml
owner:
  blueId: UserBlueId
```

can expand to:

```yaml
owner:
  name: Alice
  email: alice@example.com
```

**minimization**

Normalizing a resolved snapshot or resolved tree back to a minimal overlay.
Minimization must preserve the resolved snapshot semantics and semantic BlueId.

Example flow:

```ts
const node = blue.yamlToNode(input);
const resolved = blue.resolve(node);
const minimal = blue.minimize(resolved);
```

**low-level Section 8 hash**

The direct hash of an already prepared node or JSON shape, exposed through
`BlueIdCalculator`. This does not resolve provider references and is distinct
from semantic identity APIs.

**strict provider storage**

Provider ingest rejects ambiguous `blueId + payload` authoring/storage shapes
and rejects supplied IDs that do not match computed storage identity.
