# BLUE TS DSL SDK — Stage 5 testing strategy

## Primary oracles

Stage 5 uses the same permanent public oracles as the earlier stages:
- preprocess + canonical `official` JSON equivalence
- BlueId equivalence where practical
- processor-backed runtime proofs through `document-processor`

Raw YAML formatting is not the oracle.

## Test files

### Java-derived parity

- `libs/sdk-dsl/src/__tests__/DocBuilder.ai.parity.test.ts`

This file covers:
- AI scaffolding
- `askAI(...)`
- `onAIResponse(...)`
- task templates
- named expected responses
- permission timing modes
- manual permission configuration
- explicit AI step helpers
- named-event matcher shape
- guardrails

### Processor-backed runtime

- `libs/sdk-dsl/src/__tests__/DocBuilder.ai.integration.test.ts`

This file proves:
- init-driven permission request emission
- granted -> subscribe progression
- subscription readiness updates
- `askAI(...)` call-operation emission
- response handling with `_SaveAIContext`
- explicit response type + task filtering
- manual permission requests
- multi-integration isolation
- public-runtime limitation for named-event AI response matching

### Canonical scenario corpus

- `libs/sdk-dsl/src/__tests__/CanonicalAIProviderPatterns.test.ts`

This file reconstructs the canonical provider request/response correlation scenario from:
- `docs/ts-dsl-sdk/canonical-scenarios/ai-provider-patterns.md`

## Runtime test rules

### Use runtime-confirmed request schemas on caller operations

Current `document-processor` operation matching requires:
- the operation contract to declare a request schema
- the incoming `Conversation/Operation Request` payload to match it

Stage 5 runtime tests therefore give caller operations explicit request types when they are the entrypoint for `askAI(...)` or manual permission flows.

This is required for executable runtime proofs. It does not change parity coverage for the higher-level AI helpers themselves.

### Named-event matcher coverage is split

Named-event matcher coverage is intentionally split:
- parity tests prove the document shape
- runtime tests prove the current public-runtime limitation

This keeps Stage 5 honest against:
- the final mapping reference section 2.3
- the current repository/runtime schemas

## Coverage targets

Stage 5 coverage is considered complete when the suite contains:
- parity coverage for all public Stage 5 surfaces
- runtime coverage for all runtime-confirmed AI flows
- at least one canonical AI provider scenario
- explicit deviation coverage for any runtime limitation that cannot be fixed inside `libs/sdk-dsl`
