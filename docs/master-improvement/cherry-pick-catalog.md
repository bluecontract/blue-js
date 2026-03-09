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
