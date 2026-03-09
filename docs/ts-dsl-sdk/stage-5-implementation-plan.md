# BLUE TS DSL SDK — Stage 5 implementation plan

## Outcome

Stage 5 is implemented as a thin, higher-level caller-side orchestration layer over the existing Stage 3 and Stage 4 MyOS/session primitives.

The implementation stayed within scope:
- no provider-side macro builder was added
- no Stage 6+ payment or PayNote work was introduced
- no `document-processor` changes were required

## Implemented workstreams

### 1. AI integration state and materialization

Implemented in:
- `libs/sdk-dsl/src/lib/builders/doc-builder.ts`
- `libs/sdk-dsl/src/lib/internal/interactions.ts`

Completed behavior:
- AI integration registry/state
- deterministic token / request / subscription ids
- configurable sessionId / permissionFrom / statusPath / contextPath / requesterId
- permission timing modes:
  - init
  - event
  - document change
  - manual
- generated permission / subscribe / ready / rejected workflows

### 2. Task templates and expected-response metadata

Implemented in:
- `libs/sdk-dsl/src/lib/builders/doc-builder.ts`
- `libs/sdk-dsl/src/lib/builders/steps-builder.ts`

Completed behavior:
- task template registration
- merged task + inline instructions
- typed expected responses
- named expected responses with optional root-field descriptors
- duplicate and unknown task guardrails

### 3. AI step helpers

Implemented in:
- `libs/sdk-dsl/src/lib/builders/steps-builder.ts`

Completed behavior:
- `StepsBuilder.askAI(...)`
- `StepsBuilder.ai(name).requestPermission(...)`
- `StepsBuilder.ai(name).subscribe(...)`

Completed materialization:
- `MyOS/Call Operation Requested`
- `MyOS/Single Document Permission Grant Requested`
- `MyOS/Subscribe to Session Requested`

### 4. AI response matchers

Implemented in:
- `libs/sdk-dsl/src/lib/builders/doc-builder.ts`

Completed behavior:
- default `Conversation/Response` matcher
- explicit response type matcher
- task-filtered matcher
- named-event matcher shape
- named-event + task-filtered matcher shape
- automatic `_SaveAIContext` prepend

### 5. Test corpus

Implemented in:
- `libs/sdk-dsl/src/__tests__/DocBuilder.ai.parity.test.ts`
- `libs/sdk-dsl/src/__tests__/DocBuilder.ai.integration.test.ts`
- `libs/sdk-dsl/src/__tests__/CanonicalAIProviderPatterns.test.ts`

Completed coverage:
- Java-derived parity scenarios
- processor-backed runtime proofs
- canonical AI provider scenario reconstruction

## Runtime-confirmed decisions

- AI orchestration remains a convenience layer over standard MyOS/session interaction.
- `askAI(...)` emits `provideInstructions` call-operation requests instead of inventing new AI transport types.
- `onAIResponse(...)` correlates through subscription id + requester, with optional task filtering.
- named-event support uses the real `Common/Named Event` type and is runtime-confirmed on the public processor.

## Follow-up constraints

The implementation intentionally does not do:
- provider document macro generation
- payment / PayNote orchestration
- access / agency expansion beyond Stage 4 foundations
- repository or dependency changes unrelated to the Stage 5 surface
