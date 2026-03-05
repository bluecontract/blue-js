# SDK DSL Known Gaps and Follow-ups

This file tracks currently known parity gaps between the TypeScript SDK DSL and the Java POC DSL.

## 1) Access/LinkedAccess/Agency interaction builders are baseline-only

- **Status**: Partial
- **Repro**:
  ```ts
  DocBuilder.doc().access('provider')
  ```
- **Expected (Java parity)**:
  - `access(...)`, `accessLinked(...)`, `agency(...)` fluent builders
  - generated request/grant/revoke workflows and listener helpers
- **Actual**:
  - baseline config builders + listener helpers are implemented.
  - linked-access helper coverage now includes `requestPermission`, `revokePermission`, `subscribe`, and `call`.
  - linked-access listener helper coverage now includes `onLinkedUpdate(...)`.
  - agency helper coverage now includes `requestPermission`, `revokePermission`, `startWorkerSession`, `call`, `callOnTarget`, `subscribe`, and `subscribeForTarget`.
  - mapping suite now covers grant/reject/revoke + session/participant lifecycle listener variants.
  - execution suite now covers request + revoke helper flows across access/linked/agency namespaces.
  - full Java parity surface (complete step wrappers + all lifecycle helpers) is still incomplete.
- **Likely cause**:
  - Initial port focused on runtime-backed core scenarios first.
- **Next actions**:
  - Expand to full parity for linked-doc and worker session orchestration variants.

## 2) Named event type alias divergence

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

## 3) PayNote default channels adjusted for processor compatibility

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

## 4) Backward payment requested type availability

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
  - API emits the same type string, but runtime typing support depends on repository version.
- **Likely cause**:
  - Alias availability differs across `@blue-repository/types` versions.
- **Next actions**:
  - Validate against target repository version used in CI/runtime.

## 5) Composite channel runtime execution coverage

- **Status**: Open
- **Repro**:
  ```ts
  // composite channel operation invocation test in sdk-dsl suite
  ```
- **Expected**:
  - operation bound to `Conversation/Composite Timeline Channel` executes via member channels.
- **Actual**:
  - mapping is covered; runtime invocation path is currently inconclusive in local integration tests.
- **Likely cause**:
  - event-shape/channel-matching semantics for composite invocation differ from current test harness assumptions.
- **Next actions**:
  - add dedicated composite-channel runtime harness scenarios aligned with document-processor internals.
