# AI provider patterns (Stage 5)

This scenario group is reserved for Stage 5 AI/provider work.

## Canonical scenarios

### Provider request/response correlation

Why included:
- proves `Conversation/Request` and `Conversation/Response` correlation
- proves requester-based filtering and isolation

Primary DSL surfaces:
- `ai(...)`
- `askAI(...)`
- `onAIResponse(...)`

### Provider max-context orchestration

Why included:
- proves a multi-step provider orchestration
- covers permission, subscribe, request, and response application
- gives a practical stateful AI workflow

Primary DSL surfaces:
- full AI orchestration builder
- AI response handler
- optional auto-context save

### Recruitment CV classifier

Why included:
- gives a multi-document/provider scenario
- covers requester isolation, alert emission, and classification logic

Primary DSL surfaces:
- `ai(...)`
- `askAI(...)`
- `onAIResponse(...)`
- composed AI workflows

## Acceptance rule

For Stage 5, do not rely only on Java AI examples. At least one large provider scenario must be reconstructed from this group.
