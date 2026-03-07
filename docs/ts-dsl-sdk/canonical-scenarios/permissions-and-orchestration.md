# Permissions and orchestration

This scenario group is the main acceptance corpus for `access(...)`, `accessLinked(...)`, and `agency(...)`.

## Canonical scenarios

### Single-document permission lifecycle

Use:
- normal account-grantee and document-grantee scenarios
- share and delegation scenarios
- revoke scenarios

Exclude:
- late-start-only branches

Primary DSL surfaces:
- `access(...)`
- `steps.access(...)`
- stage-3 support helpers already used underneath

### Linked-document permission watcher

Why included:
- provides the cleanest request/watcher pair for linked-document permissions
- proves request correlation and downstream grant observation

Primary DSL surfaces:
- `accessLinked(...)`
- `steps.myOs().requestLinkedDocsPermission(...)`
- `onMyOsResponse(...)`

### Linked-document full lifecycle

Use:
- linked-session grants and revocations
- anchor removal and re-add
- document and document-type link cases
- delegated operation scenarios

Why included:
- richest canonical corpus for linked-document permissions and link semantics

Primary DSL surfaces:
- `accessLinked(...)`
- link permission-set materialization
- granted/revoked watchers

### Worker agency permission lifecycle

Why included:
- validates worker-agency permission request documents
- validates allowed worker types and request rejection

Primary DSL surfaces:
- `agency(...)`
- `steps.viaAgency(...).requestPermission(...)`
- low-level `steps.myOs().grantWorkerAgencyPermission(...)`

### Worker session startup

Why included:
- validates `MyOS/Start Worker Session Requested` payload shape and runtime behavior
- covers worker-session bootstrap request materialization

Primary DSL surfaces:
- `steps.viaAgency(...).startSession(...)`
- `steps.myOs().startWorkerSession(...)`

## Deferred but real scenario

### Participants orchestration

Status:
- keep as a future canonical scenario
- do not make it a hard acceptance gate until a dedicated DSL surface exists

## Acceptance rule

Do this group before treating Stage 4 as hardened:
- at least one DSL reconstruction and runtime proof for single-document permissions
- at least one for linked-document permissions
- at least one for worker agency or worker-session startup
