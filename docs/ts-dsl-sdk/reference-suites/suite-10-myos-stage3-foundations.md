# Suite 10 — MyOS Stage 3 foundations

This suite covers **stage 3 helper surfaces** using real `lcloud` scenarios, without pulling in transport-only or init-mode-only behavior.

## Included source tests

### MYOS-S3-01 — Admin call/response forwarding
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-call-response-forwarding.it.test.ts`

Why included:
- it contains authored caller/target documents,
- it proves `myOsAdminUpdate` re-emission and call/response correlation,
- it exercises `MyOS/Call Operation Requested` as a real runtime flow.

Primary DSL surfaces:
- `myOsAdmin(...)`
- `steps.myOs().callOperationRequested(...)`
- `onMyOsResponse(...)`
- `onTriggeredWithMatcher(...)`

### MYOS-S3-02 — Session subscription lifecycle and filtered subscriptions
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-session-subscription.it.test.ts`

Use the following scenarios from this file:
- public event source + pattern subscriber
- revocation event source + revocation subscriber

Why included:
- they prove subscription request emission,
- filtered subscription materialization,
- subscription update matching,
- revocation handling through real admin-delivered events.

Primary DSL surfaces:
- `myOsAdmin(...)`
- `onSubscriptionUpdate(...)`
- `onTriggeredWithId(...)`
- `steps.myOs().subscribeToSessionRequested(...)`

### MYOS-S3-03 — SDPG requester/subscriber foundation
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-sdpg-request.it.test.ts`

Use the following scenarios from this file:
- subscriber document that requests SDPG, subscribes, and mirrors state
- rejected requester branch

Why included:
- this is the practical bridge from raw Stage 3 MyOS primitives to the higher-level Stage 4 access builder,
- it gives a real non-trivial document with request -> granted/rejected -> subscribe -> update behavior.

Primary DSL surfaces:
- `myOsAdmin(...)`
- `onMyOsResponse(...)`
- `onSubscriptionUpdate(...)`
- low-level `steps.myOs()` request/subscribe/call helpers

## Acceptance rule

For this suite, DSL tests should prove:
- zero shape drift for the authored documents,
- correct correlation by `requestId` or `subscriptionId`,
- correct re-emission through `myOsAdminUpdate`.
