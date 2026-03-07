# BLUE TS DSL SDK — Stage 5 deviations

## 1. Named-event AI response matchers are parity-only on the current public runtime

- **Status**: accepted
- **Construct / API**: `DocBuilder.onAIResponse(...)` named-event matcher
- **Minimal DSL repro**:

```ts
DocBuilder.doc()
  .channel('ownerChannel')
  .field('/llmProviderSessionId', 'provider-session')
  .ai('provider')
  .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
  .permissionFrom('ownerChannel')
  .requesterId('PROVIDER')
  .done()
  .onAIResponse(
    'provider',
    'onReady',
    { namedEvent: 'meal-plan-ready' },
    (steps) => steps.replaceValue('MarkReady', '/status', 'ready'),
  )
  .buildDocument();
```

- **Java expectation**: Java POC exposes named-event AI response matching as a normal runtime-capable overload.
- **Final mapping reference expectation**: section 2.3 explicitly states that the current public repo does not provide a canonical `Common/Named Event` runtime mapping.
- **Actual runtime behavior**: the DSL builds the expected matcher shape, but processor-backed delivery of a `MyOS/Subscription Update` carrying `Common/Named Event` fails on the public runtime with `Unknown type "Common/Named Event" found in type field. No BlueId mapping exists for this type.`
- **Decision**: keep named-event matcher support on the Stage 5 builder surface for parity and structural comparison, but treat it as runtime-limited on the public repo.
- **Reason**: the limitation is in current public runtime/repository type availability, not in the Stage 5 document authoring code.
- **Regression test**:
  - `libs/sdk-dsl/src/__tests__/DocBuilder.ai.parity.test.ts`
  - `libs/sdk-dsl/src/__tests__/DocBuilder.ai.integration.test.ts`

## 2. TypeScript uses an object matcher for named-event AI responses

- **Status**: accepted
- **Construct / API**: `DocBuilder.onAIResponse(...)`
- **Minimal DSL repro**:

```ts
DocBuilder.doc()
  .ai('provider')
  .sessionId('session-1')
  .permissionFrom('ownerChannel')
  .done()
  .onAIResponse(
    'provider',
    'onReady',
    { namedEvent: 'meal-plan-ready' },
    (steps) => steps.replaceValue('MarkReady', '/status', 'ready'),
  );
```

- **Java expectation**: Java uses a string overload for named-event matching.
- **Final mapping reference expectation**: named-event constraints are important, but the mapping document does not require Java's exact overload form.
- **Actual runtime behavior**: the TypeScript SDK uses an object matcher, `{ namedEvent: string }`, to avoid ambiguity with string `TypeInput` overloads such as `'Conversation/Response'` or `'Conversation/Chat Message'`.
- **Decision**: keep the object matcher as the public TypeScript API.
- **Reason**: this preserves type-safe overload resolution without introducing brittle runtime heuristics for interpreting arbitrary strings.
- **Regression test**:
  - `libs/sdk-dsl/src/__tests__/DocBuilder.ai.parity.test.ts`
