# BLUE TS DSL SDK — Stage 5 coverage matrix

| Construct / scenario | Parity coverage | Runtime coverage | Canonical coverage | Status / deviation |
|---|---|---|---|---|
| `ai(...).done()` defaults | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` init flow | `CanonicalAIProviderPatterns.test.ts` | green |
| custom `statusPath` / `contextPath` / `requesterId` | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` response + isolation flows | `CanonicalAIProviderPatterns.test.ts` | green |
| `requestPermissionOnInit()` | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` init flow | `CanonicalAIProviderPatterns.test.ts` | green |
| `requestPermissionOnEvent(...)` | `DocBuilder.ai.parity.test.ts` | none | none | parity-only |
| `requestPermissionOnDocChange(...)` | `DocBuilder.ai.parity.test.ts` | none | none | parity-only |
| `requestPermissionManually()` | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` manual permission flow | none | green |
| task definitions | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` ask-provider flow | `CanonicalAIProviderPatterns.test.ts` | green |
| `askAI(...)` inline instructions | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` ask-provider flow | `CanonicalAIProviderPatterns.test.ts` | green |
| `askAI(...)` task template merge | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` ask-provider flow | `CanonicalAIProviderPatterns.test.ts` | green |
| unknown integration rejection | `DocBuilder.ai.parity.test.ts` | not applicable | not applicable | green |
| unknown task rejection | `DocBuilder.ai.parity.test.ts` | not applicable | not applicable | green |
| missing instructions rejection | `DocBuilder.ai.parity.test.ts` | not applicable | not applicable | green |
| duplicate task rejection | `DocBuilder.ai.parity.test.ts` | not applicable | not applicable | green |
| `steps.ai(...).requestPermission(...)` | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` manual permission flow | none | green |
| `steps.ai(...).subscribe(...)` | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` granted -> subscribe flow | `CanonicalAIProviderPatterns.test.ts` | green |
| `onAIResponse(...)` default | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` response flow | `CanonicalAIProviderPatterns.test.ts` | green |
| `onAIResponse(...)` explicit response type | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` explicit-type flow | none | green |
| `onAIResponse(...)` task-filtered | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` explicit-type flow | none | green |
| `onAIResponse(...)` named-event | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` named-event flow | none | green |
| `onAIResponse(...)` named-event + task filter | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` named-event flow | none | green |
| auto `_SaveAIContext` prepend | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` response flow | `CanonicalAIProviderPatterns.test.ts` | green |
| multi-integration isolation | `DocBuilder.ai.parity.test.ts` | `DocBuilder.ai.integration.test.ts` isolation flow | none | green |
| canonical provider request/response correlation | none | `CanonicalAIProviderPatterns.test.ts` | `CanonicalAIProviderPatterns.test.ts` | green |
