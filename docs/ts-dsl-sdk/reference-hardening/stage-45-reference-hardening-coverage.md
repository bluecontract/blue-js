# Stage 4.5 Reference Hardening Coverage

## Covered scenarios
- `DOC-SEED-01` participants orchestration blueprint
  - structural equivalence
  - runtime parity for participant-add request emission and approved-contract application
- `DOC-SEED-05` call operation request blueprint
  - structural equivalence
  - runtime parity for emitted `MyOS/Call Operation Requested`
- `MYOS-S3-01` admin call/response forwarding
  - structural equivalence for the authored target document
  - runtime parity for request recording and mixed emitted response/request/event list
- `MYOS-S3-02` filtered subscription lifecycle
  - structural equivalence for public event source and pattern subscriber
  - runtime parity for subscription request emission, subscription-ready handling, and filtered update correlation
- `MYOS-S3-02` subscription revocation lifecycle
  - structural equivalence for revocation source and subscriber
  - runtime parity for pending -> active -> revoked state transitions
- `MYOS-S3-03` SDPG subscriber foundation
  - structural equivalence for request/subscription/call/update workflows
  - runtime parity for request emission, grant handling, subscription establishment, and mirrored update application
- `MYOS-S4-02` linked-doc permission watcher
  - structural equivalence for the watcher document
  - runtime parity for init-triggered linked-permission request and correlated grant observation
- `MYOS-S4-04` worker agency permission lifecycle
  - structural equivalence for the requester document
  - runtime parity for the emitted worker-agency permission request
- `MYOS-S4-05` worker session startup
  - structural equivalence for the requester/start-session document
  - runtime parity for granted -> `MyOS/Start Worker Session Requested`

## Uncovered scenarios
- `DOC-SEED-02` subscription request blueprint
  - blocker: lower signal than the Suite 10 subscription scenarios, which already cover the same stage-3 surface with stronger runtime correlation checks
- `DOC-SEED-03` SDPG request blueprint
  - blocker: superseded by the stronger `MYOS-S3-03` subscriber foundation coverage and existing Stage 4 synthetic access coverage
- `DOC-SEED-04` SDPG revoke request blueprint
  - blocker: this pass focused on reference scenarios that expose stage-3/4 document drift, while revoke-request materialization is already exercised by Stage 4 parity tests
- `MYOS-S3-03` rejected requester branch
  - blocker: not required to expose new DSL shape drift after the subscriber foundation and revocation scenarios were hardened; still a valid future addition
- `MYOS-S4-01` full SDPG lifecycle
  - blocker: larger multi-document orchestration corpus; not required for this focused hardening pass after `MYOS-S3-03` and existing Stage 4 access integration coverage
- `MYOS-S4-03` full linked-doc permission lifecycle
  - blocker: richer multi-document/link corpus than needed for this pass; `MYOS-S4-02` already exposed the linked-permission request/watcher materialization layer
- `MYOS-S4-X` participants orchestration
  - blocker: explicitly deferred in the suite docs until a dedicated DSL surface exists

## Verification summary
- targeted reference suites:
  - `ReferenceSuite00.seed-blueprints.test.ts`
  - `ReferenceSuite10.myos-foundations.test.ts`
  - `ReferenceSuite20.permissions-orchestration.test.ts`
- final required verification is recorded from the actual command pass in the task closeout
