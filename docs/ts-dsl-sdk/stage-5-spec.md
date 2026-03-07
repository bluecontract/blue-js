# BLUE TS DSL SDK — Stage 5 spec

## Purpose

Stage 5 adds the public AI / LLM-provider orchestration layer on top of:
- Stage 1 document authoring,
- Stage 2 handlers and richer steps,
- Stage 3 MyOS/admin/session-interaction foundations,
- Stage 4 access / agency abstractions.

The Stage 5 surface stays caller-side. It does not introduce a separate AI runtime type system. It composes:
- `MyOS/Single Document Permission Grant Requested`
- `MyOS/Subscribe to Session Requested`
- `MyOS/Call Operation Requested`
- `MyOS/Subscription Update`
- `Conversation/Response`
- `Conversation/Chat Message`

## Primary sources of truth

- `docs/ts-dsl-sdk/final-dsl-sdk-mapping-reference.md`
- `docs/ts-dsl-sdk/canonical-scenarios/ai-provider-patterns.md`

Java parity remains secondary for:
- public API ergonomics,
- nested builder shape,
- scenario discovery,
- naming.

## Implemented public API

### `DocBuilder.ai(name)`

Returns `AiIntegrationBuilder`, with:
- `.sessionId(value)`
- `.permissionFrom(channelKey)`
- `.statusPath(pointer)`
- `.contextPath(pointer)`
- `.requesterId(id)`
- `.requestPermissionOnInit()`
- `.requestPermissionOnEvent(typeInput)`
- `.requestPermissionOnDocChange(path)`
- `.requestPermissionManually()`
- `.task(name)`
- `.done()`

### `AiIntegrationBuilder.task(name)`

Returns `AITaskBuilder`, with:
- `.instruction(text)`
- `.expects(typeInput)`
- `.expectsNamed(eventName)`
- `.expectsNamed(eventName, ...fieldNames)`
- `.expectsNamed(eventName, fields => ...)`
- `.done()`

### `StepsBuilder.askAI(...)`

Supported overloads:
- `steps.askAI(aiName, ask => ...)`
- `steps.askAI(aiName, stepName, ask => ...)`

`AskAIBuilder` supports:
- `.task(name)`
- `.instruction(text)`
- `.expects(typeInput)`
- `.expectsNamed(eventName)`
- `.expectsNamed(eventName, ...fieldNames)`
- `.expectsNamed(eventName, fields => ...)`

### `StepsBuilder.ai(name)`

Returns `AISteps`, with:
- `.requestPermission(stepName?)`
- `.subscribe(stepName?)`

### `DocBuilder.onAIResponse(...)`

Supported forms:
- default response matcher
- explicit response type matcher
- explicit response type + task filter
- named-event matcher
- named-event matcher + task filter

TypeScript adaptation:
- named-event matching uses `AIResponseNamedEventMatcher`
- current public form is `{ namedEvent: string }`

## Materialized behavior

### `ai(...).done()`

An AI integration materializes:
- `myOsAdminChannel`, `myOsAdminUpdate`, `myOsAdminUpdateImpl` when needed
- permission request workflow
- granted -> subscribe workflow
- subscription-ready workflow
- permission-rejected workflow

Generated defaults:
- `statusPath`: `/ai/<name>/status`
- `contextPath`: `/ai/<name>/context`
- `requesterId`: tokenized integration name, for example `mealAI -> MEALAI`
- `requestId`: `REQ_<TOKEN>`
- `subscriptionId`: `SUB_<TOKEN>`

Initial document state:
- `statusPath = "pending"`
- `contextPath = {}`

Permission request semantics:
- on-behalf-of channel is `permissionFrom(...)`
- target session is `sessionId(...)`
- permissions are runtime-confirmed single-document permissions
- the generated permission set is:
  - `read: true`
  - `singleOps: ['provideInstructions']`

### `task(...)`

Tasks are templates. They persist:
- prompt/instruction fragments
- typed expected responses
- named expected responses

`askAI(...)` merges task templates with inline instructions and inline expected-response declarations.

### `askAI(...)`

`askAI(...)` emits `MyOS/Call Operation Requested` for `provideInstructions`.

The emitted request payload includes:
- `requester`
- merged `instructions`
- `context`
- optional `taskName`
- optional `expectedResponses`

Shape intent at build time:
- `instructions` are stored as a BLUE expression
- `context` is stored as `${document('<contextPath>')}`

Runtime behavior:
- prompt expressions are resolved before the event is emitted
- `context` resolves to the current context object, not to the original expression string

### `onAIResponse(...)`

`onAIResponse(...)` always matches on:
- `MyOS/Subscription Update`
- the integration `subscriptionId`
- `update.inResponseTo.incomingEvent.requester = requesterId`

Optional filters:
- explicit response type
- `taskName`
- named event name

Every `onAIResponse(...)` workflow prepends:
- `_SaveAIContext`

`_SaveAIContext` writes:
- `${event.update.context}`
to:
- `contextPath`

## Runtime notes

### Parent operations still need request schemas

When `askAI(...)` or `steps.ai(...).requestPermission(...)` is used inside a `Conversation/Sequential Workflow Operation`, the parent operation must still have a request schema that is compatible with the incoming operation request.

This is a current `document-processor` requirement, not a Stage 5-specific builder rule.

Processor-backed Stage 5 runtime tests therefore use explicit request types on caller operations when they invoke those flows through `Conversation/Operation Request`.

### Named-event support is limited by the public runtime

Stage 5 keeps named-event matcher parity on the builder surface, but public-runtime processing still lacks a runtime-confirmed `Common/Named Event` path. The exact limitation is documented in `stage-5-deviations.md`.

## Canonical scenario coverage

Stage 5 includes a processor-backed canonical scenario from:
- `docs/ts-dsl-sdk/canonical-scenarios/ai-provider-patterns.md`

Covered canonical scenario:
- Provider request/response correlation

This scenario proves:
- permission request
- granted -> subscribe progression
- subscription readiness
- provider call forwarding
- requester-based response correlation
- auto context persistence

## Exit status

Stage 5 is implemented when measured against the documented scope:
- public AI builders are present
- Java-derived parity coverage is present
- processor-backed runtime coverage is present
- at least one canonical AI provider scenario is reconstructed and proven
- deviations are explicit and narrow
