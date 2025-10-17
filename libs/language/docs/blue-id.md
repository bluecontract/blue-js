### Blue ID: canonical, content-addressed identifiers

**What it does**
`BlueIdCalculator` computes a stable ID for any Blue node or list. It canonicalizes to JSON, recursively replaces nested values with their own BlueIds, and hashes with SHA-256, Base58-encodes the 32-byte digest. Lists fold by pairwise combining element IDs.

**Algorithm sketch**

```
blueId(value):
  if value is primitive or Big:
    return hash(value.toString)
  if value is array:
    h = blueId(value[0])
    for i=1..n-1:
      h = hash([{blueId:h}, {blueId: blueId(value[i])}])
    return h
  if value is object:
    if value.blueId present: return value.blueId
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

- Empty lists are invalid (will throw).
- `name`, `value`, `description` contribute raw (not hashed sub-ids) for stability.
