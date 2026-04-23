### Blue ID: canonical, content-addressed identifiers

**What it does**
`BlueIdCalculator` computes a stable ID for any Blue node or list. It canonicalizes to JSON, recursively replaces nested values with their own BlueIds, and hashes with SHA-256, Base58-encodes the 32-byte digest. Lists fold by pairwise combining element IDs.

**Algorithm sketch**

```
blueId(value):
  if value is primitive or Big:
    return hash(value.toString)
  if value is array:
    if value is []:
      return hash([])
    h = blueId(value[0])
    for i=1..n-1:
      h = hash([{blueId:h}, {blueId: blueId(value[i])}])
    return h
  if value is object:
    if value is exactly { blueId: string }: return value.blueId
    ignore value.blueId when additional fields exist
    entries = []
    for each (k,v):
      if k in {name, value, description}:
        entries.push([k, v])
      else
        entries.push([k, {blueId: blueId(v)}])
    return hash(Object.fromEntries(entries))
```

**APIs**

- `calculateBlueId(node | node[])` / `calculateBlueIdSync(...)`
- Helpers: `BlueIdToCid.convert(blueId)`, `CidToBlueId.convert(cid)`, `BlueIds.isPotentialBlueId(str)`

**Tips**

- Empty lists are valid content and affect BlueId.
- `name`, `value`, `description` contribute raw (not hashed sub-ids) for stability.
- `$empty` is treated as normal content and contributes to BlueId.
- Milestone-1 deferred forms throw `UnsupportedFeatureError` in BlueId/minimization paths:
  - `this#<n>`
  - `$pos`
  - `$previous`
