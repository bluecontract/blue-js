### Resolve: from minimal input to a fully-typed Blue graph

`Blue.resolve(node, limits)` turns a minimal (or partial) `BlueNode` into a
`ResolvedBlueNode` by recursively merging:

- node-level data (`value`, metadata, type refs),
- inherited content from `type.blueId`,
- children (`items`, `properties`),
- merge-processor constraints (list/dictionary/type rules).

The implementation is in `Merger` and is deterministic for a given input + provider set.

## Quick version (simple)

`resolve` does this, in practice:

1. Starts from an empty node.
2. If source has `type`, it first resolves that type and applies inherited fields.
3. Then it applies source node values. Source can fill inherited typed fields, but conflicting concrete values are rejected.
4. Recursively resolves `items` and `properties`.
5. Enforces consistency checks (types, list item compatibility, dictionary rules).
6. Returns a `ResolvedBlueNode`.

For most readers, this is enough.

## Quick examples

### Example 1: extending object fields (inherit + value fill)

Base definition (`<BasePreferencesBlueId>`):

```yaml
name: Base Preferences
enabled: true
retries:
  type: Integer
```

Input node:

```yaml
name: Runtime Preferences
type:
  blueId: <BasePreferencesBlueId>
retries: 5
notes: customized
```

After `resolve`:

```yaml
name: Runtime Preferences
type:
  blueId: <BasePreferencesBlueId>
enabled: true
retries: 5
notes: customized
```

So object fields are inherited from type (`enabled`), and local values fill inherited typed fields (`retries`).

### Example 2: extending list of objects (append in derived)

Base definition (`<BaseWorkflowBlueId>`):

```yaml
name: Base Workflow
steps:
  - code: draft
    label: Draft
  - code: sign
    label: Sign
```

Input node:

```yaml
name: Sales Workflow
type:
  blueId: <BaseWorkflowBlueId>
steps:
  - code: draft
    label: Draft
  - code: sign
    label: Sign
  - code: archive
    label: Archive
```

After `resolve`, `steps` has all three objects (`draft`, `sign`, `archive`).

### Example 3: `resolve -> official -> minimize -> resolve` for inherited lists

Flow:

1. `resolved = blue.resolve(node)`
2. `official = blue.nodeToJson(resolved, 'official')`
3. `loaded = blue.jsonValueToNode(official)`
4. `minimal = blue.minimize(loaded)`
5. `resolvedAgain = blue.resolve(minimal)`

Rules for list fields in `minimal`:

- If derived appended list items, `minimize` may emit inherited-list marker + appended items.
- If derived did not override list at all, `minimize` leaves that list absent.

In both cases above, `resolvedAgain` should be semantically equivalent to `resolved`.

`blue.reverse(node)` remains as a deprecated compatibility alias for
`blue.minimize(node)`.

## Extended algorithm (optional deep dive)

### 1) Create resolution context

Each top-level `resolve()` call creates one context:

- `limits` (`NO_LIMITS` or path-based limits),
- wrapped `nodeProvider`,
- `resolvedTypeCache` (scoped to this call),
- `inheritedItemsPrefixByPath` (scoped to this call; per-pointer inherited list
  metadata used by marker-aware list merge under path limits),
- `pathStack` (for path-aware cache keys and limits traversal).

### 2) Resolve a node by merging into a fresh target

`resolveWithContext(node, ctx)`:

1. Create empty `resultNode`.
2. `mergeWithContext(resultNode, node, ctx)`.
3. Copy top-level `name`, `description`, and `blueId` from original source
   back to the final node.
4. Wrap as `ResolvedBlueNode`.

### 3) Handle source `type` first

`mergeWithContext(target, source, ctx)`:

1. Rejects nodes that still contain `blue:` directives (must be preprocessed first).
2. If `source.type` exists:
   - Resolve type node (`resolveTypeNode`).
   - Build
     `typeOverlay = resolvedType.clone().setType(undefined).setBlueId(undefined)`
     and merge it into target.
   - Merge original `source` after replacing its `type` with resolved type clone.
3. If `source.type` is absent: merge `source` directly.

This keeps type inheritance applied before source additions and compatible updates.

### 4) Resolve type references with cache

`resolveTypeNode(typeNode, ctx)`:

1. If `typeNode.blueId` exists, check `resolvedTypeCache` first.
2. Cache key:
   - `NoLimits`: `typeBlueId`
   - path-based limits: `typeBlueId|/current/pointer`
3. On cache miss:
   - clone type node,
   - `NodeExtender.extend(..., PathLimits.withSinglePath('/'))` when type has `blueId`,
   - recursively resolve extended type node,
   - store in cache.

### 5) Merge object content

`mergeObject(target, source, ctx)`:

1. Clone target shallowly.
2. Run `mergingProcessor.process(...)` pipeline.
3. Merge `items` (`mergeChildren`) if present.
4. Merge `properties` (`mergeProperties`) if present.
5. Copy `source.blueId` when present.
6. Run optional `postProcess`.

### 6) Merge list items (`mergeChildren`)

There are three modes:

1. **Target has no items yet**
   - Resolve each source child (or clone resolved child under `NoLimits`),
   - append in order (respecting limits).

2. **Source uses inherited-prefix marker**
   - Marker is recognized when:
     `source.items[0]` is a **blueId-only node** and
     `source.items[0].blueId === BlueId(target.items[])` (aggregated list BlueId).
   - If first item has marker blueId **and extra fields**, resolver throws:
     `Invalid inherited-list marker: first list item must contain only blueId.`
   - Meaning: "keep inherited target prefix, then append source items from index 1".
   - Resolver copies all target items and appends `source[1..]` (respecting limits).
   - With `PathLimits`, marker-appended items are checked against logical merged
     list indexes (`inheritedPrefixLength + appendedOffset`), not raw encoded
     source indexes (`[marker, ...]`).
   - If path limits filtered inherited target prefix away (`target.items[]` may
     be empty at that point), resolver can still recognize marker by using
     inherited prefix metadata remembered earlier for the same pointer.
   - Example: base `[A, B]`, marker form `[marker(A,B), C, D]`, limits
     `/2` and `/3` -> result contains `C` and `D` (indexes `0` and `1` were
     not requested).

3. **Standard overlay**
   - If source is shorter than target: throw.
   - For overlapping indexes: BlueId must match item-by-item.
   - Extra source items are appended.

### 7) Merge properties (`mergeProperties`)

For each source property allowed by limits:

1. Usually resolve/cloned-resolve source property node.
2. If target property does not exist: set resolved value.
3. If target property exists: recursively `mergeObject(existing, resolved, ctx)`.
4. Special case under `PathLimits`: when either side is list-like (`items` present),
   resolver merges unresolved source via `mergeWithContext(existing, source, ctx)`
   (without pre-resolving), to preserve logical list index semantics and inherited
   marker metadata.

For child-node metadata (`name`, `description`), explicit source values override
inherited type values on that same child path. Missing source metadata keeps the
inherited value.

Copy-on-write map update is used to avoid unnecessary object recreation.

## Interaction with `minimize()` and official roundtrip

`minimize()` can emit a compact representation for inherited lists. Current behavior:

- If a derived list appends items, minimize emits inherited-prefix marker:
  first list item is `blueId` of inherited list, followed by appended items.
- If derived does not override list at all, minimize now leaves list absent
  (no marker-only list).

Resolver (`mergeChildren`) understands this marker format, so this roundtrip is valid:

`resolve -> nodeToJson('official') -> jsonValueToNode -> minimize -> resolve`

for both:

- inherited list with appended elements,
- inherited list with no override in derived node.

This remains true under `PathLimits` that select only appended indices
(for example `/list/2` and `/list/3` in a logical `[A, B, C, D]` list),
because marker resolution uses logical merged indexes.

## Notes

- Dictionaries enforce key/value type constraints via merge processors.
- Already-resolved subtrees are cloned (not re-resolved) only with `NoLimits`.
- With path-based limits, subtrees are re-resolved to keep path filtering correct.
- Type resolution cache is local to one `resolve()` call.
- Resolution expects current type BlueIds; ingestion helpers normalize historical IDs.
- `Blue.calculateBlueId*` uses resolve + minimize so path limits affect
  materialization, not semantic identity.
