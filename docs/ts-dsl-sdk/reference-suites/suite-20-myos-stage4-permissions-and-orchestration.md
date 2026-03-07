# Suite 20 — MyOS Stage 4 permissions and orchestration

This suite is the main acceptance corpus for `access(...)`, `accessLinked(...)`, and `agency(...)`.

## Included source tests

### MYOS-S4-01 — SDPG lifecycle
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-sdpg.it.test.ts`

Use:
- normal account-grantee and document-grantee scenarios
- share/delegation scenarios
- revoke scenarios

Exclude:
- late-start-specific scenarios

Primary DSL surfaces:
- `access(...)`
- `steps.access(...)`
- stage-3 support helpers already used underneath

### MYOS-S4-02 — LDPG request + watcher
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-ldpg-request.it.test.ts`

Why included:
- provides the cleanest request/watcher pair for linked-doc permissions,
- proves request correlation and downstream grant observation.

Primary DSL surfaces:
- `accessLinked(...)`
- `steps.myOs().requestLinkedDocsPermission(...)`
- `onMyOsResponse(...)`

### MYOS-S4-03 — Full linked-doc permission lifecycle
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-ldpg.it.test.ts`

Use:
- linked session grants/revocations
- anchor removal/re-add
- document/document-type link cases
- delegated operation scenarios

Why included:
- this is the richest real corpus for linked-doc permissions and link semantics.

Primary DSL surfaces:
- `accessLinked(...)`
- link permission set materialization
- granted/revoked watchers

### MYOS-S4-04 — Worker agency permission lifecycle
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-wapg.it.test.ts`

Why included:
- validates worker-agency permission request documents,
- validates allowed worker types and request rejection.

Primary DSL surfaces:
- `agency(...)`
- `steps.viaAgency(...).requestPermission(...)`
- low-level `steps.myOs().grantWorkerAgencyPermission(...)`

### MYOS-S4-05 — Worker session startup
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-worker-session.it.test.ts`

Why included:
- validates `MyOS/Start Worker Session Requested` document payload shape and runtime behavior,
- covers worker-session bootstrap request materialization.

Primary DSL surfaces:
- `steps.viaAgency(...).startSession(...)`
- `steps.myOs().startWorkerSession(...)`

## Deferred but real scenario

### MYOS-S4-X — Participants orchestration
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/participants-orchestration.it.test.ts`

Status:
- keep as a future reference suite,
- do not make it a hard acceptance gate until a dedicated DSL surface exists.

## Acceptance rule

Do this suite **before** treating Stage 4 as hardened:
- at least one DSL reconstruction + runtime proof for SDPG,
- at least one for LDPG,
- at least one for worker agency/start-session.
