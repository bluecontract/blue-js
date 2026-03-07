# Stage 4.5 Canonical Scenario Hardening Spec

## Objective

Use the public canonical scenario corpus to harden the already implemented Stage 3 and Stage 4 DSL surfaces.

This pass exists to answer one question:

> Do the current Stage 3 and Stage 4 DSL builders generate documents that are materially equivalent to the canonical authored documents in this repository, and do they preserve the intended runtime behavior?

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

## Canonical sources

The canonical scenario docs define which scenarios matter:
- `canonical-scenarios/seed-blueprints.md`
- `canonical-scenarios/myos-foundations.md`
- `canonical-scenarios/permissions-and-orchestration.md`

The final document/materialization rules come from:
- `final-dsl-sdk-mapping-reference.md`
- `complex-flow-materialization-reference.md`

## What this pass hardened

### Shared comparison support
- added reusable helpers that compare `canonical raw object -> BlueNode` against `DSL-built BlueNode`
- primary oracle is `preprocess + official JSON + BlueId`, not YAML text formatting
- runtime proofs compare processor results side-by-side using public `document-processor` APIs

### Real drift fixes
- event-level helper `name` / `description` options now materialize as node metadata, not ad-hoc properties
- request-schema object conversion now treats `name` / `description` as BLUE node metadata, matching canonical authored documents
- worker-session request helper already carries `requestId` through the runtime event payload, which is required by the reference worker-session flow

### Canonical scenarios covered in this pass
- Seed blueprints:
  - participants orchestration blueprint
  - call operation request blueprint
- MyOS foundations:
  - admin call/response forwarding
  - filtered subscription lifecycle
  - subscription revocation lifecycle
  - single-document permission subscriber foundation
- Permissions and orchestration:
  - linked-document permission watcher
  - worker agency permission lifecycle
  - worker session startup

## Acceptance criteria
- Stage 3 and 4 are exercised against canonical scenarios, not only synthetic parity cases.
- At least 7 strong canonical scenarios are covered across the seed-blueprints, MyOS foundations, and permissions-and-orchestration groups.
- Any remaining gap is explicit and justified.
