# Suite 30 — AI / LLM provider scenarios (Stage 5)

This suite is the main runtime corpus for AI/provider DSL.

## Included source tests

### AI-S5-01 — Basic provider request/response correlation
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-llm-provider/llmProvider.it.test.ts`

Why included:
- proves `Conversation/Request` and `Conversation/Response` correlation,
- proves requester-based filtering/isolation.

Primary DSL surfaces:
- `ai(...)`
- `askAI(...)`
- `onAIResponse(...)`

### AI-S5-02 — Max meal planner orchestration
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-llm-provider/llmProvider.max.it.test.ts`

Why included:
- real multi-step provider orchestration,
- permission + subscribe + request + response application,
- practical stateful AI workflow.

Primary DSL surfaces:
- full AI orchestration builder
- AI response handler
- optional auto-context save

### AI-S5-03 — Recruitment CV classifier
Source:
- `references/lcloud/lcloud-develop/tests/integration/tests-llm-provider/llmProvider.recruitment-cv.it.test.ts`

Why included:
- real multi-document/provider scenario,
- requester isolation,
- alert emission and classification logic.

Primary DSL surfaces:
- `ai(...)`
- `askAI(...)`
- `onAIResponse(...)`
- composed AI workflows

## Acceptance rule

For Stage 5, do not rely only on Java AI examples.
At least one large provider scenario must be reconstructed from this suite.
