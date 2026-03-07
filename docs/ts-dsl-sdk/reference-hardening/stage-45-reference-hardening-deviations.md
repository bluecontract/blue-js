# Stage 4.5 Canonical Scenario Hardening Deviations

Use this file only for real, narrow deviations exposed by the canonical scenario corpus.

## Status

No new accepted deviations remain for the scenarios covered in this pass.

Canonical scenario hardening exposed two real Stage 3/4 drifts and both were fixed in `libs/sdk-dsl`, so they are recorded below as resolved entries rather than accepted deviations.

Existing accepted Stage 3 / Stage 4 deviations remain documented in:
- `docs/ts-dsl-sdk/stage-3-deviations.md`
- `docs/ts-dsl-sdk/stage-4-deviations.md`

## Entry template

### Title
- status:
- scenario group:
- canonical scenario:
- affected DSL surface:

#### Reference expectation
Describe the canonical shape/behavior.

#### Current DSL/runtime behavior
Describe the actual behavior.

#### Decision
State whether the DSL was fixed or the deviation is accepted.

#### Rationale
Explain why.

## Entries

### Event helper `name` / `description` were emitted as properties instead of BLUE node metadata
- status: resolved
- scenario group: Permissions and orchestration
- canonical scenario: worker agency permission lifecycle, worker session startup
- affected DSL surface: `steps.myOs().grantWorkerAgencyPermission(...)`, `steps.myOs().startWorkerSession(...)`, stage-3 event helper metadata options

#### Reference expectation
Canonical documents serialize event-level `name` and `description` as BLUE node metadata, not as nested `name` / `description` value properties.

#### Current DSL/runtime behavior
Before this pass, step helper options used plain property writes, which produced `event.name.value = ...` style output and changed BlueIds for worker-agency and worker-session request documents.

#### Decision
Fixed in the DSL.

#### Rationale
The canonical scenarios proved this was authored-document drift, not a runtime limitation. The helper layer now writes metadata to the event node itself.

### Request-schema object conversion treated `name` / `description` as ordinary properties
- status: resolved
- scenario group: MyOS foundations
- canonical scenario: admin call/response forwarding, filtered subscription lifecycle
- affected DSL surface: `.request({...})` object-schema conversion

#### Reference expectation
Canonical authored request schemas use BLUE metadata fields for `name` and `description`, including nested request field definitions.

#### Current DSL/runtime behavior
Before this pass, object-schema conversion preserved `type` and `blueId` specially, but materialized `name` / `description` as ordinary child properties. That changed request-schema shape and BlueIds for reference documents.

#### Decision
Fixed in the DSL.

#### Rationale
The canonical documents and runtime-correct mapping behavior were consistent. The object-schema converter now mirrors BLUE metadata semantics for `name` and `description`.
