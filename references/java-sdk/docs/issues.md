# Open mapping issues

## 1) `Common/Named Event` mapping not discoverable in current repo.blue packages

- Java bean: `blue.language.types.common.NamedEvent`
- Current annotation value in codebase was a placeholder-style string.
- Lookup method:
  - Checked package index on `repo.blue/packages`
  - Checked `Common` package type list on `repo.blue/packages/Common/types`
- Result:
  - Current `Common` package exposes only `Currency` and `Timestamp` in the selected public revision.
  - No `Named Event` type page is available to extract authoritative type Blue ID.
- Action taken:
  - Kept existing alias/BlueId for `NamedEvent` unchanged.
  - Deferred until package revision containing `Common/Named Event` is publicly available.

## 2) `Payments/* Requested` types package not discoverable in current repo.blue package index

- Java beans: nested request classes under `blue.language.types.payments.PaymentRequests`
- Current annotation values are placeholder-style IDs.
- Lookup method:
  - Enumerated public package list from `repo.blue/packages`
  - Attempted direct lookups for a `Payments` package/type pages.
- Result:
  - `Payments` package is not currently listed in the public package index.
  - No canonical type pages are available to retrieve authoritative Blue IDs and full field schemas.
- Action taken:
  - Kept `PaymentRequests` nested class Blue IDs unchanged for now.
  - Deferred mapping update until `Payments` package/type docs are accessible.

## 3) Non-44-char IDs that are still canonical in repo.blue

During audit, some canonical IDs are 43 characters in current repo metadata:

- `Core/Triggered Event Channel` → `C77W4kVGcxL7Mkx9WL9QESPEFFL2GzWAe647s1Efprt`
- `MyOS/MyOS Session Link` → `d1vQ8ZTPcQc5KeuU6tzWaVukWRVtKjQL4hbvbpC22rB`

These were not treated as placeholders and were left unchanged.

## 4) Missing attached SDK DSL mapping reference for DocBuilder/PayNoteBuilder task

- Task requested reading an attached "SDK DSL Mapping Reference" before implementation.
- Current workspace does not include that attached reference document/file.
- Action taken:
  - Implemented based on in-repo DSL sources/tests (`DocBuilder`, `PayNoteBuilder`, parity/integration suites).
  - Kept behavior aligned with existing DSL outputs and canonical comparison rules used by `DslParityAssertions`.

## 5) `bootstrapDocument` wording mismatch vs current nested PayNote embedding shape

- Task scenario mentions detecting nested `bootstrapDocument` in voucher-related workflow steps.
- Current Java DSL + fixtures use nested PayNote composition through payment request payload field:
  - `triggerPayment(...).attachPayNote(...)`
  - serialized shape key: `attachedPayNote`
- Action taken:
  - Coverage/tests validate nested PayNote composition via `attachedPayNote`.
  - No `bootstrapDocument` key was introduced to avoid unrelated DSL shape refactors.
