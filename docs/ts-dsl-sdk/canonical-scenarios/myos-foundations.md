# MyOS foundations

This scenario group covers Stage 3 helper surfaces without pulling in transport-only or init-mode-only behavior.

## Canonical scenarios

### Admin call/response forwarding

Why included:
- contains authored caller and target documents
- proves `myOsAdminUpdate` re-emission and call/response correlation
- exercises `MyOS/Call Operation Requested` as a real runtime flow

Primary DSL surfaces:
- `myOsAdmin(...)`
- `steps.myOs().callOperationRequested(...)`
- `onMyOsResponse(...)`
- `onTriggeredWithMatcher(...)`

### Filtered subscription lifecycle

Why included:
- proves subscription request emission
- proves filtered subscription materialization
- proves subscription update matching with explicit `subscriptionId` correlation

Primary DSL surfaces:
- `myOsAdmin(...)`
- `onSubscriptionUpdate(...)`
- `steps.myOs().subscribeToSessionRequested(...)`

### Subscription revocation lifecycle

Why included:
- proves revocation handling through admin-delivered events
- proves grouped pending, active, and revoked state transitions

Primary DSL surfaces:
- `myOsAdmin(...)`
- `onTriggeredWithId(...)`
- `steps.myOs().subscribeToSessionRequested(...)`

### Single-document permission subscriber foundation

Why included:
- provides the bridge from raw Stage 3 MyOS primitives to the higher-level Stage 4 access builder
- gives a non-trivial document with request -> granted/rejected -> subscribe -> update behavior

Primary DSL surfaces:
- `myOsAdmin(...)`
- `onMyOsResponse(...)`
- `onSubscriptionUpdate(...)`
- low-level `steps.myOs()` request, subscribe, and call helpers

## Acceptance rule

For this group, DSL tests should prove:
- zero shape drift for the authored documents
- correct correlation by `requestId` or `subscriptionId`
- correct re-emission through `myOsAdminUpdate`
