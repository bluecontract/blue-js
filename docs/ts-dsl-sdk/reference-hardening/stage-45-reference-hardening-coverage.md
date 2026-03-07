# Stage 4.5 Canonical Scenario Hardening Coverage

## Covered scenarios
- Participants orchestration blueprint
  - structural equivalence
  - runtime parity for participant-add request emission and approved-contract application
- Call operation request blueprint
  - structural equivalence
  - runtime parity for emitted `MyOS/Call Operation Requested`
- Admin call/response forwarding
  - structural equivalence for the authored target document
  - runtime parity for request recording and mixed emitted response/request/event list
- Filtered subscription lifecycle
  - structural equivalence for the public event source and pattern subscriber
  - runtime parity for subscription request emission, subscription-ready handling, and filtered update correlation
- Subscription revocation lifecycle
  - structural equivalence for the revocation source and subscriber
  - runtime parity for pending -> active -> revoked state transitions
- Single-document permission subscriber foundation
  - structural equivalence for request, subscription, call, and update workflows
  - runtime parity for request emission, grant handling, subscription establishment, and mirrored update application
- Linked-document permission watcher
  - structural equivalence for the watcher document
  - runtime parity for init-triggered linked-permission request and correlated grant observation
- Worker agency permission lifecycle
  - structural equivalence for the requester document
  - runtime parity for the emitted worker-agency permission request
- Worker session startup
  - structural equivalence for the requester/start-session document
  - runtime parity for granted -> `MyOS/Start Worker Session Requested`

## Uncovered scenarios
- Subscription request blueprint
  - blocker: lower signal than the MyOS foundations subscription scenarios, which already cover the same Stage 3 surface with stronger runtime correlation checks
- Single-document permission request blueprint
  - blocker: superseded by the stronger single-document permission subscriber foundation coverage and existing Stage 4 access coverage
- Single-document permission revoke blueprint
  - blocker: this pass focused on canonical scenarios that expose Stage 3/4 document drift, while revoke-request materialization is already exercised by Stage 4 parity tests
- Rejected requester branch for the single-document permission subscriber foundation
  - blocker: not required to expose new DSL shape drift after the subscriber foundation and revocation scenarios were hardened; still a valid future addition
- Full single-document permission lifecycle
  - blocker: larger multi-document orchestration corpus; not required for this focused pass after the subscriber foundation and existing Stage 4 access integration coverage
- Full linked-document permission lifecycle
  - blocker: richer multi-document/link corpus than needed for this pass; the linked-document permission watcher already exposed the request/watcher materialization layer
- Participants orchestration as a dedicated Stage 4 surface
  - blocker: explicitly deferred in the canonical scenario docs until a dedicated DSL surface exists

## Verification summary
- targeted scenario test files:
  - `CanonicalSeedBlueprints.test.ts`
  - `CanonicalMyOsFoundations.test.ts`
  - `CanonicalMyOsPermissionsAndOrchestration.test.ts`
- final required verification is recorded from the actual command pass in the task closeout
