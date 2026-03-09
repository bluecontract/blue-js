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
- named-event AI response matching on the public runtime

### Canonical scenario corpus

- `libs/sdk-dsl/src/__tests__/CanonicalAIProviderPatterns.test.ts`

This file reconstructs the canonical provider request/response correlation scenario from:
- `docs/ts-dsl-sdk/canonical-scenarios/ai-provider-patterns.md`

## Runtime test rules

### Caller-operation request schemas are optional

Current runtime behavior allows `Conversation/Sequential Workflow Operation`
handlers to execute when the parent operation omits `request`.

Stage 5 runtime tests may still give caller operations explicit request types
when the scenario intentionally exercises repository-level request typing, but
this is no longer treated as a generic runtime requirement for `askAI(...)` or
manual permission flows.

### Named-event matcher coverage is end-to-end

Named-event matcher coverage now proves both:
- parity shape using `Common/Named Event`
- positive runtime execution on the public processor/runtime

This keeps Stage 5 aligned with:
- the final mapping reference section 2.3
- the current repository/runtime schemas

## Coverage targets

Stage 5 coverage is considered complete when the suite contains:
- parity coverage for all public Stage 5 surfaces
- runtime coverage for all runtime-confirmed AI flows
- at least one canonical AI provider scenario
- explicit deviation coverage for any runtime limitation that cannot be fixed inside `libs/sdk-dsl`
