# Cherry-pick catalog

Use this file to track what is intentionally adopted from the alternative implementation.

## Rules

- Every entry must be specific.
- Do not write vague notes like "borrowed some ideas".
- For every entry include:
  - source area in donor
  - target area in mainline
  - what was adopted
  - whether it was copied, adapted, or reimplemented
  - why it was needed
  - tests/docs added

## Candidate items to evaluate

### Public ergonomics
- `buildJson()` / alias-style JSON export
- `SimpleDocBuilder`
- generic `contract(...)` / `contracts(...)`

### Generic authoring surface
- `contractsPolicy(...)`
- `directChange(...)`
- `proposeChange(...)`
- `acceptChange(...)`
- `rejectChange(...)`
- `anchors(...)`
- `links(...)`
- `canEmit(...)`

### Payment / conversation conveniences
- `triggerPayment(...)`
- `requestBackwardPayment(...)`

### Architecture
- modularization patterns from donor builder layout

### Companion package
- `libs/myos-js` as separate companion package, if quality bar is met

## Adopted items

### Stage A — alias-style JSON export

- Source area in donor:
  `references/alternative-sdk-serious/libs/sdk-dsl/src/lib/core/serialization.ts`
  and
  `references/alternative-sdk-serious/libs/sdk-dsl/src/lib/doc-builder/doc-builder.ts`
- Target area in mainline:
  `libs/sdk-dsl/src/lib/alias-json.ts`,
  `libs/sdk-dsl/src/lib/builders/doc-builder.ts`,
  `libs/sdk-dsl/src/lib/index.ts`
- What was adopted:
  public `nodeToAliasJson(...)` and builder-level `buildJson()`
- How:
  adapted and reimplemented
- Why:
  external consumers needed a public alias-style export surface instead of writing local normalization helpers
- Tests/docs added:
  `libs/sdk-dsl/src/__tests__/DocBuilder.ergonomics.test.ts`,
  `docs/ts-dsl-sdk/master-improvement/scorecard.md`,
  `docs/ts-dsl-sdk/master-improvement/stage-roadmap.md`

### Stage A — contract insertion helpers

- Source area in donor:
  `references/alternative-sdk-serious/libs/sdk-dsl/src/lib/doc-builder/doc-builder.ts`
- Target area in mainline:
  `libs/sdk-dsl/src/lib/builders/doc-builder.ts`
- What was adopted:
  `contract(key, contractLike)` and `contracts(record)`
- How:
  adapted and reimplemented
- Why:
  external consumers should not need `field('/contracts/...')` for normal contract authoring
- Tests/docs added:
  `libs/sdk-dsl/src/__tests__/DocBuilder.ergonomics.test.ts`,
  `docs/ts-dsl-sdk/master-improvement/scorecard.md`,
  `docs/ts-dsl-sdk/master-improvement/stage-roadmap.md`
