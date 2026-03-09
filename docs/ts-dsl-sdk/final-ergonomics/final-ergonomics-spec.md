# Final SDK ergonomics / semantics pass

## Objective
Take the current mainline `libs/sdk-dsl` from “very strong” to “finalized” by resolving what the current public runtime actually supports and reducing low-value raw authoring in external consumer code.

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
Re-audit outcome:
- the current public runtime still channelizes timeline events as full timeline entries,
- `onChannelEvent(...)` therefore continues to adapt convenience matchers under `event.message` for timeline-like channels,
- the correction in this pass is to keep docs/tests honest about that runtime-backed shape.

### 2. Stage-6 operation-triggered PayNote branches
Re-audit outcome:
- follow-up runtime verification showed that requestless operation handlers are
  accepted on the normal resolved-document runtime path already used by real
  consumers,
- the final semantics should therefore be documented and tested as
  runtime-confirmed behavior, not as a Stage-6-specific workaround,
- the final runtime-confirmed behavior is to omit `request` when the generated
  branch should accept arbitrary or empty payloads.

## Required ergonomic uplift
Add one minimal generic workflow authoring helper so consumers can build normal `Conversation/Sequential Workflow` contracts without dropping fully to raw contract objects.

The helper should be generic and small. It should not create a second giant DSL surface.

Final delivered helper:
- `DocBuilder.workflow(...)`
- thin builder with `channel(...)`, `event(...)`, `steps(...)`, `done()`
- convenience overloads for `(key, channel, steps)` and `(key, channel, event, steps)`
