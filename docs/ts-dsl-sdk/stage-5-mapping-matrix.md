# BLUE TS DSL SDK — Stage 5 mapping matrix

| Construct / helper | Primary mapping reference | Materialized runtime artifact | Notes |
|---|---|---|---|
| `ai(name)` | 6.1, 6.3, 8.3 | permission / subscribe / readiness / rejection workflows plus MyOS admin scaffolding when required | convenience layer over Stage 3 primitives |
| AI defaults | 5.2, 5.4, 6.3 | `statusPath = /ai/<name>/status`, `contextPath = /ai/<name>/context`, `requesterId = <TOKEN>`, `requestId = REQ_<TOKEN>`, `subscriptionId = SUB_<TOKEN>` | token generated with runtime-safe normalization |
| `permissionFrom(...)`, `sessionId(...)` | 5.2, 6.3 | SDPG + subscribe target wiring | used by both auto flows and explicit `steps.ai(...)` helpers |
| permission timing modes | 5.2, 6.3 | init/event/doc-change/manual permission request entrypoints | manual mode composes with explicit steps |
| `task(...)` | 6.3 + Java parity | stored task template with instructions and expected responses | merged into `askAI(...)` at build time |
| `AITaskBuilder.expects(...)` | 3.1, 6.3 | `expectedResponses` typed entry | stored as a BLUE type node |
| `AITaskBuilder.expectsNamed(...)` | 2.3, 6.3 | named-event expectation node shape | parity-complete, runtime-limited on public repo |
| `StepsBuilder.askAI(...)` | 5.5, 6.3 | `MyOS/Call Operation Requested` for `provideInstructions` | emitted request includes requester, instructions, context, optional taskName, optional expectedResponses |
| `steps.ai(name).requestPermission(...)` | 5.2, 6.3 | explicit `MyOS/Single Document Permission Grant Requested` step | permission set is runtime-confirmed `read + provideInstructions` |
| `steps.ai(name).subscribe(...)` | 5.4, 6.3 | explicit `MyOS/Subscribe to Session Requested` step | uses deterministic subscription id |
| `onAIResponse(...)` default | 5.4, 6.3 | `MyOS/Subscription Update` matcher for `Conversation/Response` | prepends `_SaveAIContext` |
| `onAIResponse(...)` explicit response type | 3.1, 5.4, 6.3 | `update.type = <explicit response type>` | runtime-covered with `Conversation/Chat Message` |
| `onAIResponse(...)` task filter | 2.2, 6.3 | `update.inResponseTo.incomingEvent.taskName = <task>` | rejects unknown tasks at build time |
| `onAIResponse(...)` named-event matcher | 2.3, 6.3 | matcher node using `Common/Named Event` shape | TypeScript adaptation uses `{ namedEvent: string }`; runtime limitation documented |
| canonical AI provider scenario | 6.3 + canonical AI provider corpus | request/response correlation flow with permission + subscribe + response application | covered in `CanonicalAIProviderPatterns.test.ts` |
