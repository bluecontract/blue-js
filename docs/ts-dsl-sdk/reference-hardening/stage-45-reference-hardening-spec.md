# Stage 4.5 Reference Hardening Spec

## Objective

Use real reference scenarios from `lcloud`- and bank-derived suites to harden the already implemented stage 3 and stage 4 DSL surfaces.

This pass exists to answer one question:

> Do the current stage 3 and 4 DSL builders generate documents that are materially equivalent to real reference documents and do they preserve the intended runtime behavior?

## In scope

### Stage 3 surfaces
- `myOsAdmin(...)`
- `myOsAdmin(channelKey)` if already implemented
- `onTriggeredWithId(...)`
- `onTriggeredWithMatcher(...)`
- `onSubscriptionUpdate(...)`
- `onMyOsResponse(...)`
- `steps.myOs().singleDocumentPermissionGrantRequested(...)`
- `steps.myOs().subscribeToSessionRequested(...)`
- `steps.myOs().callOperationRequested(...)`

### Stage 4 surfaces
- `access(...)`
- `accessLinked(...)`
- `agency(...)`
- related stage-4 helper steps that materialize permission / worker-session flows
- stage-3/4 low-level MyOS step helpers when they are the canonical materialization layer for the reference scenario

## Out of scope
- Stage 5 AI feature expansion
- Stage 6 PayNote feature expansion
- API transport tests
- init mode / LATE_START / bootstrap endpoint transport behavior
- editing pipeline

## Reference sources

The reference scenario suites define which real scenarios matter:
- `reference-suites/suite-00-seed-blueprints.md`
- `reference-suites/suite-10-myos-stage3-foundations.md`
- `reference-suites/suite-20-myos-stage4-permissions-and-orchestration.md`

The final document/materialization rules come from:
- `final-dsl-sdk-mapping-reference.md`
- `complex-flow-materialization-reference.md`

## What this pass hardened

### Shared comparison support
- added reusable helpers that compare `reference raw object -> BlueNode` against `DSL-built BlueNode`
- primary oracle is `preprocess + official JSON + BlueId`, not YAML text formatting
- runtime proofs compare processor results side-by-side using public `document-processor` APIs

### Real drift fixes
- event-level helper `name` / `description` options now materialize as node metadata, not ad-hoc properties
- request-schema object conversion now treats `name` / `description` as BLUE node metadata, matching canonical authored documents
- worker-session request helper already carries `requestId` through the runtime event payload, which is required by the reference worker-session flow

### Reference suites covered in this pass
- Suite 00:
  - `DOC-SEED-01` participants orchestration blueprint
  - `DOC-SEED-05` call operation request blueprint
- Suite 10:
  - `MYOS-S3-01` admin call/response forwarding
  - `MYOS-S3-02` filtered subscription lifecycle
  - `MYOS-S3-02` subscription revocation lifecycle
  - `MYOS-S3-03` SDPG subscriber foundation
- Suite 20:
  - `MYOS-S4-02` linked-doc permission request watcher
  - `MYOS-S4-04` worker agency permission lifecycle
  - `MYOS-S4-05` worker session startup

## Acceptance criteria
- Stage 3 and 4 are exercised against real reference scenarios, not only synthetic parity cases.
- At least 7 strong reference-backed scenarios are covered across Suite 00/10/20.
- Any remaining gap is explicit and justified.
