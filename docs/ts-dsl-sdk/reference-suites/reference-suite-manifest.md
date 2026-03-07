# Reference suite manifest

This manifest is the single index of the curated reference suites.

See also:
- `reference-suites-overview.md`
- `reference-suite-manifest.json`
- the individual suite files

## Included suites

| Suite | Stages | Kind | Primary source files |
|---|---|---|---|
| `suite-00-seed-blueprints` | 3–4 | source corpus | `tests-db/documentBuilders.ts`, `tests-db/docHelpers.ts` |
| `suite-10-myos-stage3-foundations` | 3 | acceptance | `myos-admin-call-response-forwarding.it.test.ts`, `myos-admin-session-subscription.it.test.ts`, `myos-admin-sdpg-request.it.test.ts` |
| `suite-20-myos-stage4-permissions-and-orchestration` | 4 | acceptance | `myos-admin-sdpg.it.test.ts`, `myos-admin-ldpg-request.it.test.ts`, `myos-admin-ldpg.it.test.ts`, `myos-admin-wapg.it.test.ts`, `myos-admin-worker-session.it.test.ts` |
| `suite-30-ai-stage5-provider-patterns` | 5 | acceptance | `llmProvider.it.test.ts`, `llmProvider.max.it.test.ts`, `llmProvider.recruitment-cv.it.test.ts` |
| `suite-40-paynote-stage6-business` | 6 | acceptance | paynote bootstrap / webhook / customer-action / delivery / mandate tests |

## Key policy

Use the suites incrementally:
- harden Stage 3 and 4 against the real MyOS suites **before** treating later stages as finished,
- then use the AI suite for Stage 5,
- then the PayNote/business suite for Stage 6.

Do not postpone all of this to a final end-stage.
