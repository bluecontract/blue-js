# BLUE TS DSL SDK — Stage 6 deviations

## 1. Reserve/release lock helpers are unsupported on the current public repo

- **Status**: accepted
- **Construct / API**: `reserve().lockOnInit()/unlockOn...`, `release().lockOnInit()/unlockOn...`
- **Minimal DSL repro**:

```ts
PayNotes.payNote('Reserve lock unsupported').currency('USD').amountMinor(1000).reserve().lockOnInit();
```

- **Java expectation**: the Java POC exposes reserve/release lock and unlock helpers alongside capture lock and unlock helpers.
- **Final mapping reference expectation**: the public mapping reference confirms native capture lock/unlock events, but does not confirm equivalent reserve/release lock/unlock event types on the current public repo.
- **Actual runtime behavior**: the current public repo does not provide repo-confirmed reserve/release lock or unlock event types to materialize.
- **Decision**: keep capture lock/unlock support; reject reserve/release lock helpers with a clear runtime-focused error.
- **Reason**: emitting unconfirmed native event types would create non-public payloads that drift away from the current repository/runtime source of truth.
- **Regression test**:
  - `libs/sdk-dsl/src/__tests__/PayNotes.parity.test.ts`

## 2. Operation-triggered PayNote macro branches need explicit request schemas

- **Status**: accepted
- **Construct / API**: `unlockOnOperation(...)`, `requestOnOperation(...)`, `requestPartialOnOperation(...)`
- **Minimal DSL repro**:

```ts
PayNotes.payNote('Capture op trigger').currency('USD').amountMinor(1000).capture().requestOnOperation('requestCapture', 'payerChannel', 'Request capture').done();
```

- **Java expectation**: the Java POC materializes requestless operation branches for these macros.
- **Final mapping reference expectation**: the flow structure is still `Conversation/Operation` plus `Conversation/Sequential Workflow Operation`, but the public runtime is the final execution gate.
- **Actual runtime behavior**: the public `document-processor` executes sequential workflow operations only when the operation contract exposes a request schema compatible with the incoming `Conversation/Operation Request` payload. Empty object request schemas do not match on this runtime.
- **Decision**: Stage 6 materializes executable request schemas:
  - `Boolean` for trigger-only operation branches
  - `Integer` for partial-amount operation branches
- **Reason**: this preserves the Stage 6 macro surface while making the generated contracts runnable on the current public runtime.
- **Regression test**:
  - `libs/sdk-dsl/src/__tests__/PayNotes.parity.test.ts`
  - `libs/sdk-dsl/src/__tests__/PayNotes.integration.test.ts`

## 3. External events do not directly drive `triggeredEventChannel` workflows

- **Status**: accepted
- **Construct / API**: `requestOnEvent(...)`, `unlockOnEvent(...)`, `onEvent(...)`-driven PayNote business flows
- **Minimal DSL repro**:

```ts
PayNotes.payNote('Capture from external event').currency('USD').amountMinor(1800).capture().requestOnEvent('PayNote/Funds Captured').done();
```

- **Java expectation**: Java examples read as if an external matched event can directly trigger the generated workflow.
- **Final mapping reference expectation**: `triggeredEventChannel` remains the correct structural materialization target for event-driven workflows, but public runtime behavior is authoritative for delivery semantics.
- **Actual runtime behavior**: `processExternalEvent(...)` skips processor-managed channels such as `Core/Triggered Event Channel`. Event-driven workflows on that channel run only when the matched event is emitted internally or re-emitted through a runtime-confirmed bridge such as `myOsAdminUpdate`.
- **Decision**: keep the canonical structural materialization on `triggeredEventChannel`, but write runtime proofs using internal emit or `myOsAdminUpdate` re-emission.
- **Reason**: this preserves document shape parity while staying honest about the current public runtime's event delivery model.
- **Regression test**:
  - `libs/sdk-dsl/src/__tests__/PayNotes.integration.test.ts`
  - `libs/sdk-dsl/src/__tests__/CanonicalPayNoteBusiness.test.ts`

## 4. `requestBackwardPayment(...)` is runtime-guarded on the current public repo

- **Status**: accepted
- **Construct / API**: `steps.requestBackwardPayment(...)`
- **Minimal DSL repro**:

```ts
DocBuilder.doc().onInit('bootstrap', (steps) =>
  steps.requestBackwardPayment((payload) =>
    payload
      .processor('guarantorChannel')
      .from('payeeChannel')
      .to('payerChannel')
      .currency('USD')
      .amountMinor(10000)
      .reason('voucher-activation'),
  ),
);
```

- **Java expectation**: the Java POC materializes `PayNote/Backward Payment Requested` directly.
- **Final mapping reference expectation**: Stage 6 follows the current public repository/runtime as the final executable surface.
- **Actual runtime behavior**: the currently installed public `@blue-repository/types` package does not expose the alias `PayNote/Backward Payment Requested`.
- **Decision**: keep the public helper, but fail fast with a clear runtime-focused error when the alias is unavailable.
- **Reason**: this preserves the ergonomic surface without pretending the current public runtime can resolve a type alias that is not actually installed.
- **Regression test**:
  - `libs/sdk-dsl/src/__tests__/StepsBuilder.convenience.test.ts`
