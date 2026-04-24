### Architecture overview

**High-level flow**

1. Parse YAML/JSON → `BlueNode` (custom YAML schema for big integers/decimals).
2. Preprocess (`BlueDirectivePreprocessor`, `Preprocessor`)
   - Map inline type names → BlueIds
   - Infer primitive types
   - (async) Fetch `blue:` URLs with allow-listed `UrlContentFetcher`
3. Normalize historical type BlueIds to current (`yamlToNode/jsonValueToNode`)
4. Resolve (`Merger`)
   - Provider chain (`NodeProviderWrapper`) = Bootstrap → Repositories → Your provider(s)
   - MergingProcessor pipeline to enforce consistency
5. Use
   - Compute semantic BlueId, convert to DTO (Zod), patch (RFC-6902), limit traversal (`PathLimits`), match types, minimize to storage/authoring overlay.
   - Serialize to a target repository version with `nodeToJson/nodeToYaml` + `BlueContext`

For identity terminology and planned semantic boundaries, see
`docs/glossary.md` and the ADRs in `docs/adr/`.

Phase 1 identity behavior is captured in
`docs/adr/0007-phase-1-semantic-identity-and-storage.md`: public
`Blue.calculateBlueId*` uses semantic identity, providers store minimal overlay
content, and `BlueIdCalculator` remains the low-level Section 8 hasher.

**Provider composition**

```ts
const wrapped = NodeProviderWrapper.wrap(myProvider, repositories);
// Internally: SequentialNodeProvider([Bootstrap, RepositoryBased, myProvider])
```

`repositories` is the list of generated repository packages (e.g. from `@blue-repository/types`) used for type aliases, contents, and schemas.

**Limits**

- `PathLimits.withSinglePath('/a/*/b')`, `withMaxDepth(3)`, or derived from a type node with `PathLimits.fromNode(typeNode)`.
- Combine with `CompositeLimits.of(a, b)`; `NO_LIMITS` by default.

**Patching**

- `applyBlueNodePatch(es)` implements `add/replace/remove/copy/move/test` on BlueNode trees with JSON Pointer paths.
