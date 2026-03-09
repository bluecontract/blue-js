# Final SDK ergonomics / semantics pass

## Objective
Take the current mainline `libs/sdk-dsl` from “very strong” to “finalized” by resolving the last known semantic mismatches and reducing low-value raw authoring in external consumer code.

## Current state
Already present and should be preserved:
- `buildJson()`
- `nodeToAliasJson(...)`
- `contract(...)`
- `contracts(...)`
- `SimpleDocBuilder`
- change lifecycle helpers
- anchors / links helpers
- `canEmit(...)`
- convenience payment helpers
- stage 1–7 tests and canonical scenarios

## Required corrections
### 1. `onChannelEvent(...)`
For timeline-like channels, workflow event matching should be authored directly against the underlying event type, not a synthetic `message:` wrapper.

### 2. Stage-6 operation-triggered PayNote branches
Generic trigger branches should not force synthetic `Boolean` / `Integer` request schemas when omission of `request` is the correct runtime-compatible shape.

## Required ergonomic uplift
Add one minimal generic workflow authoring helper so consumers can build normal `Conversation/Sequential Workflow` contracts without dropping fully to raw contract objects.

The helper should be generic and small. It should not create a second giant DSL surface.
