### Preprocessor: blue directives, inference, and inline-type replacement

**What it does**
Before resolution, `Preprocessor` performs document-level transformations declared under the `blue:` directive (or the default “simple Blue”). It:

1. Replaces inline type strings with BlueId imports using configured mappings.
2. Infers basic types for untyped primitive values (`Text/Integer/Double/Boolean`).
3. Validates no stray inline type values remain.

Mappings are assembled from core types plus registered repository aliases via `BlueIdsMappingGenerator` and injected into the default Blue transformation at runtime.

**Blue directive sources**

- Alias (from mappings/aliases)
- Raw BlueId (e.g. `blue: 294NBT...`)
- URL string (async mode only; fetched via allow-listed `UrlContentFetcher`)

**Pseudocode**

```ts
function preprocessWithDefaultBlue(doc) {
  const blueNode = doc.blue ?? defaultSimpleBlue;
  if (blueNode) {
    extend(blueNode, '/*');
    for (const transformation of blueNode.items ?? []) {
      const processor = provider.getProcessor(transformation);
      doc = processor.process(doc);
    }
    doc.blue = undefined;
  }
  ValidateInlineTypesReplaced.process(doc);
  return doc;
}
```

**Key processors**

- `ReplaceInlineValuesForTypeAttributesWithImports` – maps `"Text"` → `{ blueId: ... }` etc.
- `InferBasicTypesForUntypedValues` – tags `value: 123` as `Integer`, `"abc"` as `Text`, etc.

**Historical BlueIds**

`Preprocessor` only applies transformations. Normalization to current type BlueIds happens after preprocessing in the `yamlToNode/jsonValueToNode` entry points; if you construct nodes manually, ensure they already use current BlueIds before type checks or schema output.
