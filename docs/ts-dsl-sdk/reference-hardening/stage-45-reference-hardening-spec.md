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

## Acceptance criteria
- Stage 3 and 4 are exercised against real reference scenarios, not only synthetic parity cases.
- At least 7 strong reference-backed scenarios are covered across Suite 00/10/20.
- Any remaining gap is explicit and justified.
