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
- Provider/storage ingest is strict. `yamlToNode` and `jsonValueToNode` are
  permissive parse APIs unless a future strict mode is added.
- JSON/YAML/raw values passed to `Blue.calculateBlueId*` are preprocessed by the
  public API. `BlueNode` values are assumed to be already
  preprocessed/normalized.
- `[]` is content. It is distinct from `null`, absent, and `{}`.
- `[A]` is distinct from `A`; nested lists are not flattened.
- A list element `{ blueId: X }` is ordinary content. If `X` points to a list,
  expansion materializes that element as a nested list; it is not flattened and
  is not treated as `$previous`.
- Authoring sugar and wrapped form are identity-equivalent:
  `x: 1 == x: { value: 1 }`, and `x: [a, b] == x: { items: [a, b] }`.
- Top-level arrays passed to `Blue.calculateBlueId*` are semantic lists:
  JSON arrays, `BlueNode[]`, and exact `{ items: [...] }` wrappers produce the
  same identity for the same effective list content.
- Basic inferred scalar/list type wrappers introduced by preprocessing are
  identity-transparent. Arbitrary type references are not ignored for identity.

**Storage**

Providers store minimal overlay content keyed by the computed BlueId. If a
repository or caller supplies `providedBlueId`, it must match the computed ID or
loading fails. Normal provider/storage ingest does not keep a transitional
storage overlay path. Legacy inherited-list markers are not recognized as a
default storage format. Spec-native list controls are supported in Phase 1K:
`$previous` anchors inherited append prefixes, `$pos` carries positional
refinements before hashing, and `$empty` remains ordinary list content. Top-level
direct cyclic document sets with `this#k` references are stored as canonical
sets under a master BlueId; named members are exposed by providers as
`MASTER#i` document identities.

`$previous` append controls are hashable without loading the previous list
contents. The list hash is a fold, so the previous list BlueId can seed the fold
and appended items can be folded after it. `$pos` is different: replacing a
final index needs the previous list elements, not only the previous list BlueId.
For that reason raw hashing rejects `$pos`; semantic identity first resolves the
control form to the final list, then hashes a hashable minimal form.
Top-level `$previous`, `$pos`, and `$empty` controls are validated in list
context before hashing. `$previous` is not blindly trusted, `$pos` is consumed
or rejected before it can reach the raw hasher, and malformed `$empty` or mixed
list-control payloads are rejected before low-level hashing.

`this#k` in authoring input addresses the input document index before canonical
sorting. Providers rewrite those references to final sorted `MASTER#k` suffixes
when documents are fetched. A standalone materialized node returned by
`getNodeByName()` does not carry source identity metadata; use the provider's
name mapping, `fetchByBlueId("MASTER#i")`, or a pure `{ blueId: "MASTER#i" }`
reference when the final cyclic document identity is needed.

**Related APIs**

- `Blue.minimize(node)` returns a minimal overlay for a resolved tree or
  provider-backed node.
- `BlueIdToCid.convert(blueId)` / `CidToBlueId.convert(cid)` convert between
  BlueId and CIDv1.
- `BlueIds.isPotentialBlueId(str)` validates BlueId shape.
