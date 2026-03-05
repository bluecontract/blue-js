# @blue-labs/sdk-dsl

TypeScript DSL for composing Blue documents (`BlueNode`) with fluent builders, runtime-oriented helper flows, structure extraction, and JSON patch generation.

## Install in workspace

This package is part of the monorepo under `libs/sdk-dsl`.

## Quick start

```ts
import { DocBuilder, BasicBlueTypes } from '@blue-labs/sdk-dsl';

const doc = DocBuilder.doc()
  .name('Counter')
  .field('/counter', 0)
  .channel('ownerChannel', {
    type: 'Conversation/Timeline Channel',
    timelineId: 'owner-timeline',
  })
  .operation('increment', 'ownerChannel', BasicBlueTypes.Integer, 'Increment', (steps) =>
    steps.replaceExpression(
      'IncrementCounter',
      '/counter',
      "document('/counter') + event.message.request",
    ),
  )
  .buildDocument();
```

## Features

- `DocBuilder` / `SimpleDocBuilder` fluent authoring API
- step composition (`StepsBuilder`) including MyOS and payment helpers
- AI integration builder + response workflows
- PayNote builder (`PayNotes.payNote(...)`)
- `DocStructure.from(...)` for structure extraction
- `DocPatch.from(...)` for RFC-6902 style patch generation

## Testing locally

- Type check:
  - `npx tsc -p libs/sdk-dsl/tsconfig.lib.json --noEmit`
- Lint:
  - `npx eslint libs/sdk-dsl`
- Tests:
  - `NX_DAEMON=false npx nx test sdk-dsl --skip-nx-cache`

## Current status

See:
- `docs/sdk-dsl-js-port-checklist.md`
- `issues.md`
- `mappings_diff.md`
