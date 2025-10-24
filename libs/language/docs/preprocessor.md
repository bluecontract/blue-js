### Preprocessor: blue directives, inference, and inline-type replacement

**What it does**
Before resolution, `Preprocessor` performs document-level transformations declared under the `blue:` directive (or the default “simple Blue”). It:

1. Replaces inline type strings with BlueId imports using configured mappings.
2. Infers basic types for untyped primitive values (`Text/Integer/Double/Boolean`).
3. Validates no stray inline type values remain.

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
