# Seed blueprints

This scenario group is a compact corpus of authored documents. It is not the main acceptance group by itself, but it provides clean baseline document shapes already exercised elsewhere in the runtime.

## Canonical blueprint scenarios

### Participants orchestration blueprint

What it contributes:
- MyOS admin base document
- triggered-event channel
- init lifecycle channel
- participant add/remove workflows
- participant add/remove operations and implementations
- participants orchestration marker contract

Primary DSL surfaces:
- Stage 3 foundation: `myOsAdmin(...)`, `onEvent(...)`
- Stage 4-adjacent MyOS composition: operation builder and raw steps
- Deferred future surface: dedicated participants-orchestration DSL

### Subscription request blueprint

What it contributes:
- owner/admin channels
- subscribe operation and implementation
- emitted `MyOS/Subscribe to Session Requested`

Primary DSL surfaces:
- Stage 3: `steps.myOs().subscribeToSessionRequested(...)`
- Stage 3/4 runtime proof for subscription request emission

### Single-document permission request blueprint

What it contributes:
- single-document permission grant request emission through an operation implementation

Primary DSL surfaces:
- Stage 3 low-level MyOS step helpers
- Stage 4 `access(...)` acceptance bridge

### Single-document permission revoke blueprint

What it contributes:
- single-document permission revoke request emission through an operation implementation

Primary DSL surfaces:
- Stage 4 `steps.access(...).revokePermission(...)`
- low-level `steps.myOs().revokeSingleDocPermission(...)`

### Call operation request blueprint

What it contributes:
- `MyOS/Call Operation Requested` emission through an operation implementation

Primary DSL surfaces:
- Stage 3 `steps.myOs().callOperationRequested(...)`
- Stage 4 `steps.access(...).call(...)`

## How to use this group

Use these blueprints to:
- build compact parity tests,
- seed helper builders in TypeScript tests,
- validate low-level document fragments before moving to larger end-to-end scenario groups.
