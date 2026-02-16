### Resolve: from minimal input to a fully-typed Blue graph

**What it does**
Resolution takes a (possibly minimal) `BlueNode` and merges it with all referenced types and documents (via `blueId`, `type`, `itemType`, etc.), producing a `ResolvedBlueNode`. The process is deterministic and driven by a pluggable MergingProcessor pipeline.

**How it fits**
`Blue.resolve(node, limits)` creates a fresh node and repeatedly merges source into target. If a node references a type (`type.blueId`) the type is first extended (fetch provider → expand references) and then merged. Resolved type definitions are cached within a single `resolve()` call (path-sensitive key when using path limits). Items and properties are merged respecting path limits to avoid over-expansion.

**Key algorithm (simplified)**

```ts
function resolve(node, limits) {
  const target = {};
  return asResolved(merge(target, node, limits));
}

function merge(target, source, limits) {
  // type blueId -> resolved type cache (scoped to current resolve context)
  // cache key is path-sensitive when limits are path-based

  // 1) apply processors sequentially (value, type, list/dict, metadata, basic checks)
  const processed = pipeline.process(target, source, provider);

  // 2) merge children (items & properties) with path-aware checks and ID consistency
  for (let i = 0; i < (source.items?.length ?? 0); i++) {
    if (limits.allow(i)) {
      const child = source.items[i];
      const childNode =
        child.isResolved() && limits.isNoLimits()
          ? child
          : resolve(child, limits);
      processed.items[i] = childNode;
    }
  }
  for (const [k, v] of Object.entries(source.properties ?? {})) {
    if (limits.allow(k)) {
      const valueNode =
        v.isResolved() && limits.isNoLimits() ? v : resolve(v, limits);
      processed.properties[k] = merge(processed.properties?.[k] ?? {}, valueNode, limits);
    }
  }

  // 3) postProcess (final checks)
  return pipeline.postProcess?.(processed, source, provider) ?? processed;
}
```

**Notes**

- Lists enforce same BlueId at the same index when overlaying.
- Dictionaries enforce key/value types via `ListProcessor`/`DictionaryProcessor`.
- `PathLimits.fromNode(typeNode)` lets `isTypeOfNode` and `resolve` reason with the target shape only.
- Already-resolved subtrees are reused only for unrestricted resolution (`NoLimits`); with path-based limits they are re-merged to preserve path filtering.
- Type resolution cache is scoped to one `resolve()` call, so repeated `type.blueId` references avoid repeated extension/resolution work.
- Resolution assumes type references use current BlueIds. `yamlToNode/jsonValueToNode` normalize during ingestion; for manually constructed nodes, ensure the types are already current before resolving.
