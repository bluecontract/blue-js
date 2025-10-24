# @blue-labs/language

Small, fast TypeScript runtime for the Blue Language: parse YAML/JSON into BlueNode graphs, preprocess (directives & mappings), resolve/merge types and references, and compute stable Blue IDs (Base58-SHA256) with first-class Zod interop.

## Features

- **BlueNode graph**: single, list, map, typed values, metadata (name/description), `contracts`, and references by `blueId`.
- **Preprocessing**: `blue:` directive (aliases, BlueId, or URL fetch with allow-list), inline-type mappings, implicit type inference for primitives.
- **Resolution/Merge**: deterministic resolver with a pluggable MergingProcessor pipeline (value propagation, type checking, list/dict validators, metadata propagation, basic-type guard).
- **BlueId**: canonical JSON → SHA-256 → Base58; sync/async, lists supported; CIDv1 conversion.
- **Providers**: resolve by BlueId from memory, repositories or built-in bootstrap content; sequential composition.
- **Zod mapping**: convert nodes to typed objects with schema extensions & Blue annotations; serialize objects back to Blue-shaped JSON.
- **Limits & paths**: restrict extension/merge by path or depth; compose limits.
- **Patching & transforms**: RFC-6902-style patch ops for BlueNode; recursive transform utilities.
- **URL fetching**: pluggable strategy + caching + domain allow-list (opt-in).

## Installation

```bash
npm i @blue-labs/language zod
# or
yarn add @blue-labs/language zod
```

## Quick start

```ts
import { Blue, BasicNodeProvider, PathLimits } from '@blue-labs/language';
import { z } from 'zod';

// 1) Construct runtime (uses bootstrap types + your provider chain)
const blue = new Blue({
  nodeProvider: new BasicNodeProvider(),
});

// 2) Parse YAML (or JSON) into a BlueNode
const yaml = `
name: Greeting
value: Hello, Blue!
`;
const node = blue.yamlToNode(yaml);

// 3) Resolve (merge types/references), optionally with limits
const resolved = blue.resolve(node, PathLimits.withMaxDepth(10));

// 4) Compute BlueId
const blueId = blue.calculateBlueIdSync(resolved);

// 5) Map to a Zod schema (with annotations supported)
const Greeting = z.object({
  name: z.string().optional(),
  value: z.string(),
});
const asObject = blue.nodeToSchemaOutput(resolved, Greeting);

// 6) Convert back to JSON (choose strategy)
const official = blue.nodeToJson(resolved, 'official');
```

## API Overview (essentials)

### Core graph

- `BlueNode` – node model (name, description, type, itemType, keyType, valueType, value, items, properties, blueId, blue directive).
- `ResolvedBlueNode` – wrapper for resolved nodes; includes `getMinimalNode()` and `getMinimalBlueId()`.

### Entry point

- `class Blue`
  - Parsing: `yamlToNode(_)/jsonValueToNode(_)` (+ async variants).
  - Preprocess: blue directive (`BlueDirectivePreprocessor`) + default pipeline (`Preprocessor`).
  - Resolve: `resolve(node, limits)` → `ResolvedBlueNode`.
  - IDs: `calculateBlueId(_)/calculateBlueIdSync(_)`.
  - Mapping: `nodeToJson(node, 'official'|'simple'|'original')`, `nodeToSchemaOutput(node, zod)`.
  - Type checks: `isTypeOf(node, zod)`, `isTypeOfNode(node, typeNode)`.
  - Helpers: `extend(node, limits)`, `transform(node, fn)`, `reverse(node)`, `restoreInlineTypes(node)`.
  - Config: URL fetch allow-list (`enablePreprocessingDirectivesFetchForDomains([...])`), global limits, repositories.

### Resolution & merge

- `Merger` + `MergingProcessor` pipeline: value → types → lists/dicts → metadata → basic checks.
- `createDefaultMergingProcessor()` exports the default pipeline.

### Providers

- `NodeProvider`, `SequentialNodeProvider`, `BootstrapProvider`, `InMemoryNodeProvider`, `BasicNodeProvider`, `RepositoryBasedNodeProvider`.
- `NodeProviderWrapper.wrap(...)` composes bootstrap, repositories, and your provider.

### Preprocessing

- `BlueDirectivePreprocessor`: resolves `blue:` directive (alias, BlueId, or URL).
- `Preprocessor`: runs transformations declared under `blue:` (replace inline type strings → BlueIds; infer basic types; validate inline types removed).
- `BlueIdsMappingGenerator`: accumulate BlueId mappings (repositories, custom, core).

### Mapping & Zod

- `NodeToObjectConverter` + converters for primitives/arrays/tuples/sets/maps/objects; supports schema extension resolution via `TypeSchemaResolver`.
- Schema annotations: `withTypeBlueId`, `withBlueId`, `withBlueName`, `withBlueDescription`, `blueIdField`, `blueNodeField`.

### Blue IDs & CIDs

- `BlueIdCalculator` (sync/async); `Base58Sha256Provider`.
- `BlueIds` validator; `BlueIdToCid` and `CidToBlueId` converters.

### Limits

- `PathLimits`, `CompositeLimits`, and `NO_LIMITS`. Build from node shape or explicit patterns.

### Utilities

- `Nodes`, `NodeTransformer`, `NodePathAccessor` (`/path` getter), patching via `applyBlueNodePatch(es)` implementing RFC-6902.
- URL fetching: `UrlContentFetcher` with pluggable `{ fetchUrl }` and domain allow-list.

## Docs

- `docs/resolve.md` – resolver & merging pipeline.
- `docs/preprocessor.md` – blue directive, inference & mappings.
- `docs/blue-id.md` – BlueId algorithm and APIs.
- `docs/mapping.md` – Zod mapping and serialization.
- `docs/architecture.md` – end-to-end architecture.

## Changelog

The [Changelog](https://github.com/bluecontract/blue-js/blob/main/CHANGELOG.md) is regularly updated to reflect what's changed in each new release.

## Contributing

We welcome contributions! Please read our [Contributing Guide](https://github.com/bluecontract/blue-js/blob/main/CONTRIBUTING.md) to learn about how you can contribute.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
