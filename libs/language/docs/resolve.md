### Resolve: from minimal input to a fully-typed Blue graph

**What it does**
Resolution takes a (possibly minimal) `BlueNode` and merges it with all referenced types and documents (via `blueId`, `type`, `itemType`, etc.), producing a `ResolvedBlueNode`. The process is deterministic and driven by a pluggable MergingProcessor pipeline.

**How it fits**
`Blue.resolve(node, limits)` creates a fresh node and repeatedly merges source into target. If a node references a type (`type.blueId`) the type is first extended (fetch provider → expand references) and then merged. Items and properties are merged respecting path limits to avoid over-expansion.

**Key algorithm (simplified)**

```ts
function resolve(node, limits) {
  const target = {};
  return asResolved(merge(target, node, limits));
}

function merge(target, source, limits) {
  // 1) apply processors sequentially (value, type, list/dict, metadata, basic checks)
  const processed = pipeline.process(target, source, provider);

  // 2) merge children (items & properties) with path-aware checks and ID consistency
  for (let i = 0; i < (source.items?.length ?? 0); i++) {
    if (limits.allow(i)) {
      processed.items[i] = resolve(source.items[i], limits);
    }
  }
  for (const [k, v] of Object.entries(source.properties ?? {})) {
    if (limits.allow(k)) {
      processed.properties[k] = merge(processed.properties?.[k] ?? {}, resolve(v, limits), limits);
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
