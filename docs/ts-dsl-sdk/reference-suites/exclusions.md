# Explicit exclusions from the reference scenario suites

These tests are real and useful, but they are **not part of the reference suites for DSL -> document generation**.

## Excluded from `lcloud`

### REST/API transport and query tests
Exclude the whole directory:
- `references/lcloud/lcloud-develop/tests/integration/tests-rest-api/**`

Reason:
- these tests focus on REST contracts, transport, query projections, endpoint validation, or UI/search behavior,
- not on authored document generation from DSL.

### `initMode` / `LATE_START`
Explicitly exclude:
- `tests-rest-api/document-init-mode.it.test.ts`
- `tests-rest-api/links.it.test.ts` scenarios that assert `initMode`
- `tests-myos-admin/myos-admin-sdpg.it.test.ts` late-start-specific scenarios

Reason:
- `initMode` / `LATE_START` are backend/runtime concerns outside the core DSL -> document authoring boundary.

### Bootstrap endpoint behavior
Exclude as acceptance corpus:
- `tests-rest-api/document-bootstrap.it.test.ts`
- `tests-myos-admin/myos-admin-bootstrap.it.test.ts`

Reason:
- bootstrap endpoint/status behavior is not the same thing as authored-document generation.
- bootstrap *request events* remain in scope elsewhere through worker-session and paynote suites.

### DB/idempotency semantics
Exclude the following as acceptance suites:
- `tests/integration/tests-db/*.it.test.ts`

Reason:
- these are persistence/idempotency tests.
- however `tests-db/documentBuilders.ts` and `tests-db/docHelpers.ts` remain **included as seed document corpus**.

### Deferred MyOS surface
Exclude for now:
- `tests-myos-admin/participants-orchestration.it.test.ts`

Reason:
- this is a valid future reference suite, but the current DSL plan does not yet define a dedicated participants-orchestration builder surface.

## Excluded from `demo-bank-app`

### API handlers and outward API tests
Exclude:
- `references/demo-bank-app/demo-bank-app-feat-paynote-voucher-integration/apps/bank-api/src/paynote/**`

Reason:
- these test external API behavior around the paynote subsystem, not authored-document generation.

### Non-authoring utility tests
Exclude:
- `parsePayNotePdf.test.ts`
- `validatePayNote.test.ts`

Reason:
- these do not define or validate authored BLUE document structure through runtime flows.
