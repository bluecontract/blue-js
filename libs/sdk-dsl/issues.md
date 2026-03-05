# SDK DSL Known Gaps and Follow-ups

This file tracks currently known parity gaps between the TypeScript SDK DSL and the Java POC DSL.

## 1) Named event type alias divergence

- **Status**: Open
- **Repro**:
  ```ts
  new StepsBuilder().namedEvent('EmitNamed', 'event-x', (payload) =>
    payload.put('foo', 'bar'),
  );
  ```
- **Expected (Java parity)**:
  - `type: Common/Named Event`
- **Actual**:
  - Emits `type: Conversation/Event` with `name` + optional `payload`.
- **Likely cause**:
  - `Common/Named Event` alias is unavailable in `@blue-repository/types@0.9.0`.
- **Next actions**:
  - Switch back to `Common/Named Event` when alias is available in repository models.

## 2) PayNote default channels adjusted for processor compatibility

- **Status**: Open
- **Repro**:
  ```ts
  PayNotes.payNote('Armchair').buildJson();
  ```
- **Expected (Java mapping reference)**:
  - `payerChannel`, `payeeChannel`, `guarantorChannel` typed as `Core/Channel`.
- **Actual**:
  - These channels are emitted as `Conversation/Timeline Channel` with deterministic timeline ids.
- **Likely cause**:
  - `Core/Channel` is not executable in `document-processor` default registry for runtime tests.
- **Next actions**:
  - Revisit once processor supports generic channel execution for this flow.

## 3) Backward payment requested type availability

- **Status**: Open
- **Repro**:
  ```ts
  new StepsBuilder().requestBackwardPayment((payload) =>
    payload.processor('voucher'),
  );
  ```
- **Expected (Java mapping reference)**:
  - `type: PayNote/Backward Payment Requested`
- **Actual**:
  - API emits the same type string, but current workspace repository models reject it at build/runtime validation (`Unknown type "PayNote/Backward Payment Requested"...`).
- **Likely cause**:
  - Alias availability differs across `@blue-repository/types` versions.
- **Next actions**:
  - Validate against target repository version used in CI/runtime.

## 4) Reserve/release lock/unlock event type availability

- **Status**: Open
- **Repro**:
  ```ts
  PayNotes.payNote('Release Lock Unsupported')
    .release()
    .lockOnInit()
    .done()
    .buildDocument();
  ```
- **Expected (Java mapping reference)**:
  - `PayNote/Reserve Lock Requested`
  - `PayNote/Reserve Unlock Requested`
  - `PayNote/Reservation Release Lock Requested`
  - `PayNote/Reservation Release Unlock Requested`
- **Actual**:
  - Current workspace repository models reject lock/unlock aliases during validation:
    - `PayNote/Reserve Lock Requested`
    - `PayNote/Reserve Unlock Requested`
    - `PayNote/Reservation Release Lock Requested`
    - `PayNote/Reservation Release Unlock Requested`
  - (`Unknown type "...Lock/Unlock Requested"...` validation errors).
- **Likely cause**:
  - Alias/type coverage differs across `@blue-repository/types` versions.
- **Next actions**:
  - Revalidate release lock/unlock aliases against the target repository model version and re-enable full runtime coverage once available.

