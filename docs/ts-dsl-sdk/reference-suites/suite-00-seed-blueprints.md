# Suite 00 — Seed document blueprints from `lcloud/tests-db`

This suite is a **source corpus of authored documents**. It is not the main acceptance suite by itself, but it gives clean baseline document shapes already used in real tests.

## Source files

- `references/lcloud/lcloud-develop/tests/integration/tests-db/documentBuilders.ts`
- `references/lcloud/lcloud-develop/tests/integration/tests-db/docHelpers.ts`

## Canonical blueprint scenarios

### DOC-SEED-01 — Participants orchestration document
Source:
- `buildParticipantsOrchestrationDocument(...)`

What it contributes:
- MyOS admin base document
- triggered event channel
- init lifecycle channel
- participant add/remove workflows
- participant add/remove operations + impls
- participants orchestration marker contract

Primary DSL surfaces:
- Stage 3 foundation: `myOsAdmin(...)`, `onEvent(...)`
- Stage 4/adjacent MyOS: operation builder + raw steps
- Deferred future surface: dedicated participants-orchestration DSL

### DOC-SEED-02 — Subscription request document
Source:
- `buildSubscriptionDocument(...)`

What it contributes:
- owner/admin channels
- subscribe operation + impl
- emitted `MyOS/Subscribe to Session Requested`

Primary DSL surfaces:
- Stage 3: `steps.myOs().subscribeToSessionRequested(...)`
- Stage 3/4 runtime proof for subscription request emission

### DOC-SEED-03 — SDPG request document
Source:
- `buildPermissionGrantRequestDocument(...)`

What it contributes:
- single-document permission grant request emission through an operation impl

Primary DSL surfaces:
- Stage 3 low-level MyOS step helpers
- Stage 4 `access(...)` acceptance bridge

### DOC-SEED-04 — SDPG revoke request document
Source:
- `buildPermissionRevokeRequestDocument(...)`

What it contributes:
- single-document permission revoke request emission through an operation impl

Primary DSL surfaces:
- Stage 4 `steps.access(...).revokePermission(...)`
- low-level `steps.myOs().revokeSingleDocPermission(...)`

### DOC-SEED-05 — Call operation request document
Source:
- `buildCallOperationRequestDocument(...)`

What it contributes:
- `MyOS/Call Operation Requested` emission through an operation impl

Primary DSL surfaces:
- Stage 3 `steps.myOs().callOperationRequested(...)`
- Stage 4 `steps.access(...).call(...)`

## How to use this suite

Use these blueprints to:
- build compact parity tests,
- seed helper builders in TS tests,
- validate low-level document fragments before jumping to bigger end-to-end suites.
