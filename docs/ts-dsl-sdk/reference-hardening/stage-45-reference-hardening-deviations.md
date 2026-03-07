# Stage 4.5 Reference Hardening Deviations

Use this file only for real, narrow deviations exposed by the reference suites.

## Status

No new accepted deviations remain for the scenarios covered in this pass.

Reference hardening exposed two real stage-3/4 drifts and both were fixed in `libs/sdk-dsl`, so they are recorded below as resolved entries rather than accepted deviations.

Existing accepted Stage 3 / Stage 4 deviations remain documented in:
- `docs/ts-dsl-sdk/stage-3-deviations.md`
- `docs/ts-dsl-sdk/stage-4-deviations.md`

## Entry template

### Title
- status:
- suite:
- reference scenario:
- affected DSL surface:

#### Reference expectation
Describe the canonical reference shape/behavior.

#### Current DSL/runtime behavior
Describe the actual behavior.

#### Decision
State whether the DSL was fixed or the deviation is accepted.

#### Rationale
Explain why.

## Entries

### Event helper `name` / `description` were emitted as properties instead of BLUE node metadata
- status: resolved
- suite: Suite 20
- reference scenario: `MYOS-S4-04`, `MYOS-S4-05`
- affected DSL surface: `steps.myOs().grantWorkerAgencyPermission(...)`, `steps.myOs().startWorkerSession(...)`, stage-3 event helper metadata options

#### Reference expectation
Canonical reference documents serialize event-level `name` and `description` as BLUE node metadata, not as nested `name` / `description` value properties.

#### Current DSL/runtime behavior
Before this pass, step helper options used plain property writes, which produced `event.name.value = ...` style output and changed BlueIds for worker-agency and worker-session request documents.

#### Decision
Fixed in the DSL.

#### Rationale
The reference suites proved this was authored-document drift, not a runtime limitation. The helper layer now writes metadata to the event node itself.

### Request-schema object conversion treated `name` / `description` as ordinary properties
- status: resolved
- suite: Suite 10
- reference scenario: `MYOS-S3-01`, `MYOS-S3-02`
- affected DSL surface: `.request({...})` object-schema conversion

#### Reference expectation
Canonical authored request schemas use BLUE metadata fields for `name` and `description`, including nested request field definitions.

#### Current DSL/runtime behavior
Before this pass, object-schema conversion preserved `type` and `blueId` specially, but materialized `name` / `description` as ordinary child properties. That changed request-schema shape and BlueIds for reference documents.

#### Decision
Fixed in the DSL.

#### Rationale
The reference documents and runtime-correct mapping behavior were consistent. The object-schema converter now mirrors BLUE metadata semantics for `name` and `description`.
