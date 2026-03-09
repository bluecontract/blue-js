# Migration-driven pain points still worth addressing

This document intentionally focuses only on pain points that remain **after** the major uplift already added:
- `buildJson()` / `nodeToAliasJson(...)`
- `contract(...)` / `contracts(...)`
- `SimpleDocBuilder`

## 1. Generic workflow authoring still falls back to raw contract objects
External consumers can now insert contracts cleanly, but they still often need to author plain `Conversation/Sequential Workflow` contracts by hand as raw objects.

A thin generic workflow builder would reduce this without requiring many domain-specific wrappers.

## 2. `onChannelEvent(...)` semantics must match final runtime behavior
The current implementation/test corpus still documents timeline-channel matching through a `message:` wrapper. The final semantics should author the matcher directly against the underlying event.

## 3. Stage-6 operation-triggered branches are still too opinionated
Using `Boolean` or `Integer` request schemas for generic trigger operations is stricter than necessary when the runtime can execute correctly without defining `request` at all.

## What is NOT a remaining pain point here
These are already delivered and should not be treated as future work in this pass:
- `contract(...)`
- `contracts(...)`
- `buildJson()`
- `nodeToAliasJson(...)`
- `SimpleDocBuilder`
