# Migration-driven pain points and final pass outcomes

This document intentionally focuses only on pain points that remain **after** the major uplift already added:
- `buildJson()` / `nodeToAliasJson(...)`
- `contract(...)` / `contracts(...)`
- `SimpleDocBuilder`

## 1. Generic workflow authoring no longer falls back to raw contract objects by default
External consumers can now build plain `Conversation/Sequential Workflow`
contracts through `DocBuilder.workflow(...)` instead of dropping directly to raw
contract objects for common cases.

This keeps the escape hatch (`contract(...)`) available, but removes the most
common migration pain point.

## 2. `onChannelEvent(...)` was re-audited against the current runtime
The current public runtime still evaluates timeline-like channel handlers against
channelized timeline entries. As a result, `onChannelEvent(...)` continues to
adapt convenience matchers under `event.message` for timeline-like channels.

The final pass keeps that runtime-confirmed shape instead of forcing a
speculative direct-matcher rematerialization.

## 3. Stage-6 operation-triggered branches were re-verified against the current runtime
The migration-driven review exposed that the negative proof in the old `sdk-dsl`
test path did not match the resolved-document runtime path already relied on by
real consumers.

After aligning the test harness to that runtime path, operation-triggered
PayNote macro branches are confirmed to work with no materialized `request`
schema on the generated `Conversation/Operation`.

The runtime-confirmed generic path is to omit `request` entirely when the
operation should accept arbitrary or empty payloads.

## What is NOT a remaining pain point here
These are already delivered and should not be treated as future work in this pass:
- `contract(...)`
- `contracts(...)`
- `buildJson()`
- `nodeToAliasJson(...)`
- `SimpleDocBuilder`
- `workflow(...)`
