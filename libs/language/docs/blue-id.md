### Blue ID: semantic and low-level identities

Blue exposes two identity layers:

- `Blue.calculateBlueId(...)` / `Blue.calculateBlueIdSync(...)` are the public
  semantic identity APIs. They preprocess authoring input, resolve it, minimize
  the resolved tree, and hash the minimal overlay.
- `BlueIdCalculator` is the low-level Section 8 hasher. It hashes the supplied
  node or JSON shape directly and does not perform provider-backed resolution.

Use `Blue.calculateBlueId*` for application identity. Use `BlueIdCalculator`
only when you intentionally need the raw Section 8 hash of an already prepared
shape.

**Low-level Section 8 rules**

```
blueId(value):
  remove null and empty maps at any depth
  preserve empty lists

  if value is exactly { blueId: X }:
    return X
  if value is exactly { value: S }:
    return hash(canonical-json(S))
  if value is exactly { items: L }:
    replace value with L and continue with the list rule below
  if value is a scalar:
    return hash(canonical-json(value))
  if value is a list:
    acc = hash({ "$list": "empty" })
    for each item:
      acc = hash({
        "$listCons": {
          "prev": { "blueId": acc },
          "elem": { "blueId": blueId(item) }
        }
      })
    return acc
  if value is a map:
    for name, description, value: inline the value
    for every other key: include { blueId: blueId(child) }
    return hash(canonical-json(helper-map))
```

`items` is intentionally not an inline map key. The exact wrapper
`{ items: [...] }` is handled before map hashing and uses the same list fold as
authoring list sugar. Non-exact maps that contain an `items` key fall under the
"every other key" rule.

**Important behavior**

- Pure-reference short-circuit applies only to exact `{ blueId: "..." }`.
- Mixed `blueId + payload` is invalid for authoring/storage ingest and does not
  short-circuit in the low-level hasher.
- `[]` is content. It is distinct from `null`, absent, and `{}`.
- `[A]` is distinct from `A`; nested lists are not flattened.
- Authoring sugar and wrapped form are identity-equivalent:
  `x: 1 == x: { value: 1 }`, and `x: [a, b] == x: { items: [a, b] }`.

**Storage**

Providers store minimal overlay content keyed by the computed BlueId. If a
repository or caller supplies `providedBlueId`, it must match the computed ID or
loading fails. Phase 1 keeps legacy list marker behavior for inherited lists;
spec-native `$previous`, `$pos`, `$empty`, and direct cyclic `this#k` identities
are finalized in phase 3.

**Related APIs**

- `Blue.minimize(node)` returns a minimal overlay for a resolved tree or
  provider-backed node.
- `BlueIdToCid.convert(blueId)` / `CidToBlueId.convert(cid)` convert between
  BlueId and CIDv1.
- `BlueIds.isPotentialBlueId(str)` validates BlueId shape.
