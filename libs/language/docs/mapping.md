### Mapping: BlueNode ⇄ typed JS via Zod

**What it does**
`NodeToObjectConverter` converts a `BlueNode` into Zod-typed output. It understands Blue primitives, arrays/sets/tuples/maps/records, and complex objects. If a TypeSchemaResolver has a schema registered for the node’s BlueId (directly or via extension), it uses that concrete schema.

**How it fits**
This allows writing Zod models for Blue types and obtaining typed DTOs from resolved graphs. You can also serialize JS values back to Blue-shaped JSON honoring Blue annotations.

Type resolution expects current BlueIds. `yamlToNode/jsonValueToNode` normalize during ingestion; for manually constructed nodes, ensure the types are already current before conversion.

**Preferred conversion path**

```ts
import { Blue } from '@blue-labs/language';
import { z } from 'zod';
import { withTypeBlueId, blueIdField, blueNameField } from '@blue-labs/language/schema/annotations';

const blue = new Blue();

const PersonBase = z.object({
  id: blueIdField(),
  title: blueNameField('person'),
  name: z.string(),
});

const Person = withTypeBlueId('...BlueIdOfPersonType...')(PersonBase);

const dto = blue.nodeToSchemaOutput(resolvedNode, Person);
```

Fields declared with `blueIdField()` are populated with the semantic BlueId
computed through the converter's injected calculator. The `Blue` convenience API
injects `blue.calculateBlueIdSync(...)` for you.

**Direct converter usage**

```ts
import { NodeToObjectConverter } from '@blue-labs/language';

const converter = new NodeToObjectConverter(typeSchemaResolver, {
  calculateBlueId: (node) => blue.calculateBlueIdSync(node),
});
const dto = converter.convert(resolvedNode, Person);
```

**Serialize blue-annotated objects**

```ts
import { serializeBlueAnnotated } from '@blue-labs/language/lib/mapping/serializeBlueAnnotated';
const json = serializeBlueAnnotated(dto, Person);
```
