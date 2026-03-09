# Demo-app compatibility notes

## Strategy
The mainline `sdk-dsl` remains the source of truth.
The local demo-app SDK is only a donor for convenience names and thin wrappers.

## Expected implementation style
- If mainline already has equivalent semantics, add an alias/wrapper.
- If mainline already exports a close helper under another name, prefer exporting a compatibility alias rather than duplicating logic.
- If a demo-app helper assumes old runtime behavior, do not copy that behavior; keep current runtime-correct semantics and document the compatibility decision.

## Specific decisions
- `requestBackwardPayment(...)` stays deferred/runtime-guarded.
- `Common/Named Event` remains on the mainline, current-types implementation.
- Timeline-channel matching semantics stay as currently runtime-confirmed.
- Link/anchor wrappers should delegate to existing mainline link/anchor helpers if available.
- AI alias helpers should delegate to the existing `onAIResponse(...)` machinery.
