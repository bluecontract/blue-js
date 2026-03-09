# BLUE TS DSL SDK — Stage 5 deviations

## 1. TypeScript uses an object matcher for named-event AI responses

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
