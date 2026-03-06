# SDK DSL Developer Reference

This guide is for Java developers authoring Blue documents with the runtime DSL.

Scope:
- `blue.language.sdk.DocBuilder` / `SimpleDocBuilder`
- `blue.language.sdk.internal.StepsBuilder` (inside step lambdas)
- `blue.language.sdk.MyOsSteps` / `MyOsPermissions`
- `blue.language.sdk.paynote.PayNotes` / `PayNoteBuilder`

Use this document for authoring patterns and complete API usage.
Use `sdk-dsl-mapping-audit-reference.md` for exact output mapping shapes.

## 1) Quick Start

Minimal counter document:

```java
Node doc = DocBuilder.doc()
    .name("Counter")
    .description("Simple counter")
    .field("/counter", 0)
    .channel("ownerChannel")
    .operation("increment")
        .channel("ownerChannel")
        .requestType(Integer.class)
        .description("Increment by request amount")
        .steps(steps -> steps.replaceExpression(
            "Inc",
            "/counter",
            "document('/counter') + event.message.request"))
        .done()
    .buildDocument();
```

## 2) Choosing Builder Entry Points

| Goal | Entry |
|---|---|
| Build new document | `DocBuilder.doc()` or `SimpleDocBuilder.doc()` |
| Edit existing in place | `DocBuilder.edit(existing)` |
| Edit clone (safe template reuse) | `DocBuilder.from(existing)` |
| Build PayNote | `PayNotes.payNote(name)` |

`DocBuilder.edit(existing)` mutates the given node.
`DocBuilder.from(existing)` clones first.

## 3) Document Structure API

### 3.1 Identity

```java
.name("My Doc")
.description("...")
.type("MyOS/Agent")
.type(MyAgentType.class)
```

### 3.2 Fields

Public field API is `field(...)`.

Quick form:

```java
.field("/counter", 0)
.field("/status", "ready")
.field("/meta", new Node())
.field("/address", addressBean)
```

Builder form:

```java
.field("/score")
    .type(Integer.class)
    .description("Current score")
    .required(true)
    .minimum(0)
    .maximum(100)
    .value(42)
    .done()
```

Also available:

```java
.replace("/counter", 10)
.remove("/obsolete")
```

Pointer notes:
- Use JSON pointer paths (`/a/b/c`).
- Missing objects/arrays are created during writes.
- Root write/remove (`/`) is rejected.

### 3.3 Expression helper

```java
DocBuilder.expr("document('/counter') + 1") // -> ${document('/counter') + 1}
```

If the input is already wrapped (`${...}`), it is returned unchanged.

### 3.3 Sections (for organization + LLM context)

```java
.section("participants", "Participants", "Document channels")
    .channel("ownerChannel")
.endSection()

.section("counterOps", "Counter operations", "Increment/decrement logic")
    .field("/counter", 0)
    .operation("increment")
        .channel("ownerChannel")
        .requestType(Integer.class)
        .steps(steps -> steps.replaceExpression(
            "Inc",
            "/counter",
            "document('/counter') + event.message.request"))
        .done()
.endSection()
```

Edit existing section membership without changing title/summary:

```java
.section("counterOps")
    .operation("decrement")
        .channel("ownerChannel")
        .requestType(Integer.class)
        .steps(steps -> steps.replaceExpression(
            "Dec",
            "/counter",
            "document('/counter') - event.message.request"))
        .done()
.endSection()
```

## 4) Channels and Participants

### 4.1 Core channel

```java
.channel("ownerChannel") // type: Core/Channel
.channels("aliceChannel", "bobChannel")
```

### 4.2 Channel from bean

```java
.channel("ownerChannel", new TimelineChannel().timelineId("timeline-123"))
```

### 4.3 Composite channel

```java
.compositeChannel("owners", "aliceChannel", "bobChannel")
```

### 4.4 MyOS admin and emit helpers

```java
.myOsAdmin()              // creates myOsAdminChannel + myOsEmit + myOsEmitImpl
.myOsAdmin("adminChannel")

.canEmit("aliceChannel")
.canEmit("bobChannel", EventA.class, EventB.class)
.canEmit("celineChannel", allowedShape1, allowedShape2)
```

`canEmit(...)` creates:
- `<derivedEmitKey>` operation with `List` request
- `<derivedEmitKey>Impl` with JS step `return { events: event };`

## 5) Operations

### 5.1 Inline forms

```java
.operation("approve", "ownerChannel", "Approve order")
.operation("approve", "ownerChannel", ApprovalRequest.class, "Approve order")

.operation("approve", "ownerChannel", "Approve order", steps -> steps
    .namedEvent("EmitApproved", "order-approved"))
```

If steps are provided, DSL generates both:
- `approve` (`Conversation/Operation`)
- `approveImpl` (`Conversation/Sequential Workflow Operation`)

### 5.2 Operation builder (recommended)

```java
.operation("approve")
    .channel("ownerChannel")
    .description("Approve order")
    .requestType(ApprovalRequest.class)
    .requestDescription("Approval payload")
    .steps(steps -> steps
        .namedEvent("EmitApproved", "order-approved")
        .replaceValue("Mark", "/status", "approved"))
    .done()
```

Other request controls:

```java
.request(customRequestSchemaBeanOrNode)
.noRequest()
```

Top-level helper:

```java
.requestDescription("approve", "Approval payload")
```

### 5.3 Direct change operation helper

```java
.directChange("applyPatch", "ownerChannel", "Apply incoming changeset")
```

This creates:
- `applyPatch` operation
- `applyPatchImpl` with:
1. JS step that reads `event.message.request.changeset`
2. `updateDocumentFromExpression(...)` applying that changeset
- policy `contractsChangePolicy` with `mode = direct-change`

## 6) Workflow Contracts

### 6.1 Lifecycle and event workflows

```java
.onInit("initialize", steps -> ...)
.onEvent("onFundsCaptured", FundsCaptured.class, steps -> ...)
.onNamedEvent("onReady", "provider-ready", steps -> ...)
.onChannelEvent("onOwnerMsg", "ownerChannel", ChatMessage.class, steps -> ...)
.onDocChange("onCounterChanged", "/counter", steps -> ...)
```

### 6.2 Correlated matching helpers

```java
.onMyOsResponse("onGranted", SingleDocumentPermissionGranted.class, "REQ_X", steps -> ...)
.onMyOsResponse("onGrantedAny", SingleDocumentPermissionGranted.class, steps -> ...)

.onTriggeredWithId("onReq", SomeResponse.class, "requestId", "REQ_1", steps -> ...)
.onTriggeredWithId("onSub", SomeEvent.class, "subscriptionId", "SUB_1", steps -> ...)

.onTriggeredWithMatcher("onCustom", SomeEvent.class, matcherBean, steps -> ...)

.onSubscriptionUpdate("onSubAny", "SUB_1", steps -> ...)
.onSubscriptionUpdate("onSubTyped", "SUB_1", SomeUpdateType.class, steps -> ...)
```

## 7) StepsBuilder (inside lambdas)

You use `StepsBuilder` in `.steps(...)`, `.onInit(...)`, `.onEvent(...)`, etc.

### 7.1 Core step constructors

```java
.jsRaw("Compute", "return { changeset: [] };")

.updateDocument("Apply", cs -> cs
    .replaceValue("/status", "ready")
    .replaceExpression("/total", "document('/a') + document('/b')")
    .addValue("/items/0", "x")
    .remove("/obsolete"))

.updateDocumentFromExpression("ApplyDynamic", "steps.Compute.changeset")

.triggerEvent("EmitRaw", rawEventNode)
.emit("EmitBean", new ChatMessage().message("hello"))
.emitType("EmitTyped", FundsCaptured.class, payload -> payload.put("amount", 100))
.namedEvent("EmitNamed", "order-confirmed")
.namedEvent("EmitNamedPayload", "order-confirmed", payload -> payload
    .put("orderId", "123")
    .put("total", 2500))

.replaceValue("Mark", "/status", "done")
.replaceExpression("Calc", "/total", "document('/x') + 1")
.raw(customStepNode)
```

Important:
- `triggerEvent` / `emit` / `emitType` / `namedEvent` require explicit non-blank step names.

### 7.2 `capture()` namespace

```java
steps.capture().lock();
steps.capture().unlock();
steps.capture().markLocked();
steps.capture().markUnlocked();
steps.capture().requestNow();
steps.capture().requestPartial("event.message.request.amount");
steps.capture().releaseFull();
```

### 7.3 Step extensions

```java
steps.ext(MyCustomSteps::new).doSomething();
```

## 8) AI Integration DSL

AI integration is a first-class `DocBuilder` primitive.

### 8.1 Define integration

```java
.ai("provider")
    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
    .permissionFrom("ownerChannel")
    .statusPath("/provider/status")          // optional, default /ai/provider/status
    .contextPath("/provider/context")        // optional, default /ai/provider/context
    .requesterId("MEAL_PLANNER")             // optional, default tokenized name
    .requestPermissionOnInit()                // default
    .done()
```

Permission timing options:

```java
.requestPermissionOnInit()
.requestPermissionOnEvent(AllParticipantsReady.class)
.requestPermissionOnDocChange("/status")
.requestPermissionManually()
```

### 8.2 Reusable AI tasks

```java
.ai("provider")
    .sessionId(...)
    .permissionFrom("ownerChannel")
    .task("summarize")
        .instruction("Summarize input in bullet points.")
        .expects(ChatMessage.class)
        .expectsNamed("meal-plan-ready", "planId", "totalCalories")
        .done()
    .done()
```

Named expectation variants:

```java
.expectsNamed("event-name")
.expectsNamed("event-name", "fieldA", "fieldB")
.expectsNamed("event-name", fields -> fields
    .field("fieldA", "Description")
    .field("fieldB"))
```

### 8.3 Ask AI

```java
steps.askAI("provider", "GeneratePlan", ask -> ask
    .task("summarize")
    .instruction("Request: ${event.message.request}")
    .expectsNamed("meal-plan-warning", "code", "message"));
```

Overloads:

```java
steps.askAI("provider", ask -> ask.instruction("...")); // default step name AskAI
```

Ask builder methods:
- `task(...)`
- `instruction(...)`
- `expects(Class<?>)`
- `expects(Node)`
- `expectsNamed(...)` (all variants)
- deprecated aliases still available: `text(...)`, `expression(...)`

### 8.4 Handle AI responses

Typed response handlers:

```java
.onAIResponse("provider", "onResponse", steps -> ...)
.onAIResponse("provider", "onChat", ChatMessage.class, steps -> ...)
.onAIResponse("provider", "onSummary", ChatMessage.class, "summarize", steps -> ...)
```

Named event handlers:

```java
.onAIResponse("provider", "onPlanReady", "meal-plan-ready", steps -> ...)
.onAIResponse("provider", "onPlanReady", "meal-plan-ready", "summarize", steps -> ...)
```

All `onAIResponse(...)` handlers automatically prepend context persistence:
- `_SaveAIContext` -> replace `<contextPath>` with `event.update.context`

### 8.5 Manual AI control from steps

```java
steps.ai("provider").requestPermission();
steps.ai("provider").requestPermission("RequestNow");
steps.ai("provider").subscribe();
steps.ai("provider").subscribe("SubscribeNow");
```

## 9) MyOS Extension (`steps.myOs()`)

Get extension:

```java
steps.myOs();
steps.myOs("adminChannel");
```

Permission helpers:

```java
steps.myOs().requestSingleDocPermission(
    "ownerChannel",
    "REQ_PROVIDER",
    DocBuilder.expr("document('/providerSessionId')"),
    MyOsPermissions.create().read(true).singleOps("provideInstructions"));

steps.myOs().requestLinkedDocsPermission(
    "ownerChannel",
    "REQ_LINKED",
    DocBuilder.expr("document('/projectSessionId')"),
    Map.of("invoices", MyOsPermissions.create().read(true).allOps(true)));

steps.myOs().revokeSingleDocPermission("ownerChannel", "REQ_X", "session-1");
steps.myOs().revokeLinkedDocsPermission("ownerChannel", "REQ_X", "session-1");
```

Participant/session helpers:

```java
steps.myOs().addParticipant("bobChannel", "bob@example.com");
steps.myOs().removeParticipant("legacyChannel");
steps.myOs().callOperation("ownerChannel", "session-1", "processData", requestBean);
steps.myOs().subscribeToSession("ownerChannel", "session-1", "SUB_1");
steps.myOs().startWorkerSession("agentChannel", workerConfigNode);
```

Worker agency helpers:

```java
steps.myOs().grantWorkerAgencyPermission("ownerChannel", "REQ_W", "session-1", permissionsBean);
steps.myOs().revokeWorkerAgencyPermission("ownerChannel", "REQ_W", "session-1");
```

Bootstrap helper:

```java
steps.myOs().bootstrapDocument(
    "BootstrapChild",
    childDocNode,
    Map.of("buyerChannel", "ownerChannel"),
    options -> options
        .defaultMessage("A new child document was created.")
        .channelMessage("buyerChannel", "Please review and accept."));
```

### 9.1 MyOsPermissions builder

```java
MyOsPermissions.create()
    .read(true)
    .write(false)
    .allOps(false)
    .singleOps("provideInstructions", "getStatus")
    .build();
```

## 10) Payment Request DSL

### 10.1 Entry methods

```java
steps.triggerPayment("RequestPayment", PaymentRequests.PaymentRequested.class, payload -> payload ...);
steps.triggerPayment(PaymentRequests.PaymentRequested.class, payload -> payload ...); // default step name TriggerPayment

steps.requestBackwardPayment("VoucherCredit", payload -> payload ...);
steps.requestBackwardPayment(payload -> payload ...); // default step name RequestBackwardPayment
```

### 10.2 Core payload fields

```java
payload
    .processor("guarantorChannel") // required
    .payer("payerChannel")
    .payee("payeeChannel")
    .from("payeeChannel")
    .to("payerChannel")
    .currency("USD")
    .amountMinor(10000)
    .amountMinorExpression("document('/amount/total')")
    .reason("voucher-activation")
    .attachPayNote(childPayNoteNode);
```

### 10.3 Rail namespaces (`via*`)

```java
payload.viaAch()
    .routingNumber("111000025")
    .accountNumber("123456")
    .accountType("checking")
    .network("ACH")
    .companyEntryDescription("PAYROLL")
    .done();

payload.viaSepa().ibanFrom("DE123").ibanTo("DE456").bicTo("BIC").remittanceInformation("Inv").done();
payload.viaWire().bankSwift("SWIFT").bankName("Bank").accountNumber("123").beneficiaryName("Jane").beneficiaryAddress("Addr").done();
payload.viaCard().cardOnFileRef("cof-1").merchantDescriptor("Blue Shop").done();
payload.viaTokenizedCard().networkToken("nt").tokenProvider("tp").cryptogram("cg").done();
payload.viaCreditLine().creditLineId("facility-1").merchantAccountId("m-1").cardholderAccountId("c-1").done();
payload.viaLedger().ledgerAccountFrom("from").ledgerAccountTo("to").memo("memo").done();
payload.viaCrypto().asset("BTC").chain("bitcoin").fromWalletRef("wallet").toAddress("bc1...").txPolicy("fast").done();
```

Bean shortcuts:

```java
payload.viaAch(new AchPaymentFields()...);
payload.viaCreditLine(new CreditLinePaymentFields()...);
// ... same for all rails
```

Extension hooks:

```java
payload.rail(customRailBean);
payload.putCustom("customField", "value");
payload.putCustomExpression("customExpr", "document('/x')");
payload.ext(DemoBankPaymentFields::new)
    .creditFacilityId("facility-42")
    .riskTier("tier-a");
```

Validation:
- `processor(...)` is mandatory.
- `processor` cannot be set via `rail(...)` or `putCustom(...)`.

## 11) Bootstrap DSL

Generic bootstrap from `StepsBuilder`:

```java
steps.bootstrapDocument(
    "BootstrapDeal",
    childDocNode,
    Map.of("buyerChannel", "ownerChannel"),
    options -> options
        .assignee("myOsAdminChannel")
        .defaultMessage("A new deal has been created.")
        .channelMessage("buyerChannel", "Please review and accept."));

steps.bootstrapDocumentExpr(
    "BootstrapFromTemplate",
    "document('/template')",
    Map.of("participantA", "aliceChannel"),
    options -> options.assignee("orchestratorChannel"));
```

## 12) PayNote DSL

### 12.1 Create paynote

```java
Node payNote = PayNotes.payNote("Armchair")
    .description("Payment with delivery confirmation")
    .currency("USD")
    .amountMinor(10000)
    .capture()
        .lockOnInit()
        .unlockOnOperation("confirmSatisfaction", "payerChannel", "Buyer confirms satisfaction")
        .done()
    .buildDocument();
```

### 12.2 Action builders

Capture:

```java
.capture()
    .lockOnInit()
    .unlockOnEvent(FundsCaptured.class)
    .unlockOnDocPathChange("/approval/confirmed")
    .unlockOnOperation("confirm", "payerChannel", "Confirm")
    .requestOnInit()
    .requestOnEvent(FundsReserved.class)
    .requestOnDocPathChange("/approval/confirmed")
    .requestOnOperation("requestCapture", "guarantorChannel", "Request capture")
    .requestPartialOnOperation("requestPartialCapture", "guarantorChannel", "Partial", "event.message.request.amount")
    .requestPartialOnEvent(ShipmentConfirmed.class, "event.message.request.amount")
    .done()
```

Reserve and release use the same trigger API surface:

```java
.reserve() ... .done()
.release() ... .done()
```

Important semantic note:
- `release()` emits reservation-release requests (void/release of reserved funds), not refund of already captured funds.

Validation note:
- If action is `lockOnInit()`, at least one unlock path is required for that action.

## 13) End-to-End Examples

### 13.1 Counter with sections

```java
Node counter = DocBuilder.doc()
    .name("Counter")
    .section("participants", "Participants", "Owner channel")
        .channel("ownerChannel")
    .endSection()
    .section("counterOps", "Counter operations", "Increment/decrement")
        .field("/counter", 0)
        .operation("increment")
            .channel("ownerChannel")
            .requestType(Integer.class)
            .description("Increment")
            .steps(steps -> steps.replaceExpression("Inc", "/counter", "document('/counter') + event.message.request"))
            .done()
        .operation("decrement")
            .channel("ownerChannel")
            .requestType(Integer.class)
            .description("Decrement")
            .steps(steps -> steps.replaceExpression("Dec", "/counter", "document('/counter') - event.message.request"))
            .done()
    .endSection()
    .buildDocument();
```

### 13.2 AI integration + task + typed response

```java
Node mealPlanner = DocBuilder.doc()
    .name("Meal Planner")
    .channel("ownerChannel")
    .myOsAdmin()
    .field("/llmProviderSessionId", "session-llm-001")
    .ai("provider")
        .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
        .permissionFrom("ownerChannel")
        .task("summarize")
            .instruction("Return concise meal plan JSON")
            .expectsNamed("meal-plan-ready", "planId", "totalCalories")
            .done()
        .done()
    .operation("requestMealPlan")
        .channel("ownerChannel")
        .requestType(String.class)
        .steps(steps -> steps.askAI("provider", "Generate", ask -> ask
            .task("summarize")
            .instruction("Request: ${event.message.request}")))
        .done()
    .onAIResponse("provider", "onPlanReady", "meal-plan-ready", steps -> steps
        .replaceExpression("SavePlan", "/mealPlan", "event.update.payload"))
    .buildDocument();
```

### 13.3 Armchair + voucher + abstract backward payment

```java
Node armchair = PayNotes.payNote("Armchair Protection + Voucher")
    .description("Capture unlocks on satisfaction; voucher backward payment requested.")
    .currency("USD")
    .amountMinor(10000)
    .capture()
        .lockOnInit()
        .unlockOnOperation("confirmSatisfaction", "payerChannel", "Buyer confirms satisfaction")
        .done()
    .onEvent("requestVoucherPayment", FundsCaptured.class, steps -> steps
        .requestBackwardPayment("VoucherCredit", payload -> payload
            .processor("guarantorChannel")
            .from("payeeChannel")
            .to("payerChannel")
            .currency("USD")
            .amountMinor(10000)
            .reason("voucher-activation")
            .attachPayNote(
                PayNotes.payNote("Balanced Bowl Voucher")
                    .currency("USD")
                    .amountMinor(10000)
                    .release()
                        .requestOnInit()
                        .done()
                    .buildDocument())))
    .buildDocument();
```

### 13.4 Bootstrap child document inline

```java
Node orchestrator = DocBuilder.doc()
    .name("Orchestrator")
    .channel("ownerChannel")
    .myOsAdmin()
    .onInit("bootstrapChild", steps -> steps.bootstrapDocument(
        "BootstrapChild",
        DocBuilder.doc()
            .name("Child")
            .channel("childOwner")
            .field("/status", "created")
            .buildDocument(),
        Map.of("childOwner", "ownerChannel"),
        options -> options
            .assignee("myOsAdminChannel")
            .defaultMessage("You were invited to a child document.")))
    .buildDocument();
```

## 14) Common Pitfalls

1. Missing `endSection()`:
- `buildDocument()` throws when section is still open.

2. Assuming operation impl always exists:
- `<key>Impl` exists only when `.steps(...)` is provided.

3. Missing `processor` in payment requests:
- `triggerPayment` / `requestBackwardPayment` throw.

4. Unknown AI integration/task:
- `askAI` / `onAIResponse` validate integration and task names.

5. Event helper without step name:
- `triggerEvent`, `emit`, `emitType`, `namedEvent` require explicit non-blank step names.

## 15) API Checklist (Authoring)

- Data: `field`, `replace`, `remove`
- Grouping: `section`, `endSection`
- Channels: `channel`, `channels`, `compositeChannel`, `myOsAdmin`, `canEmit`
- Operations: `operation(...)` inline + builder form
- Workflows: `onInit`, `onEvent`, `onNamedEvent`, `onDocChange`, `onChannelEvent`
- Matchers: `onMyOsResponse`, `onSubscriptionUpdate`, `onTriggeredWithId`, `onTriggeredWithMatcher`
- Steps: `jsRaw`, `updateDocument`, `updateDocumentFromExpression`, `triggerEvent`, `emit`, `emitType`, `namedEvent`, `capture`
- AI: `ai(...).done`, `steps.askAI`, `onAIResponse`, `steps.ai(...).requestPermission/subscribe`
- MyOS: `steps.myOs().<requests>`
- Payments: `triggerPayment`, `requestBackwardPayment`, `via*` rails, `rail/putCustom/ext`
- PayNote: `PayNotes.payNote(...).capture/reserve/release`
