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

### 3.4 Sections (for organization + LLM context)

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

All DSL methods auto-track in the active section: channels, operations, workflows, fields, `access()`/`accessLinked()`/`agency()`/`ai()` generated contracts.

## 4) Channels and Participants

### 4.1 Core channel

```java
.channel("ownerChannel")
.channels("aliceChannel", "bobChannel")
```

Default mapping: `.channel("x")` creates `contracts/x` with type `Core/Channel`.

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

Note: `access()`, `accessLinked()`, `agency()`, and `ai()` auto-ensure `myOsAdmin()` is present. You do not need to call it separately when using these builders.

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

### 6.3 Document interaction listeners

These are typed convenience wrappers for documents using `access()`, `accessLinked()`, or `agency()`.

Correlation behavior:
- `onAccessGranted/Rejected/Revoked`, `onLinkedAccessGranted/Rejected/Revoked`, `onAgencyGranted/Rejected/Revoked` correlate by the configured request ID.
- `onUpdate(...)` correlates by the configured subscription ID.
- `onCallResponse`, `onSessionCreated`, `onLinkedDocGranted/Revoked`, and agency session lifecycle listeners validate the configured name and match by event type.

```java
// access() listeners
.onAccessGranted("orders", "onGranted", steps -> ...)
.onAccessRejected("orders", "onRejected", steps -> ...)
.onAccessRevoked("orders", "onRevoked", steps -> ...)
.onCallResponse("orders", "onResult", steps -> ...)
.onCallResponse("orders", "onResult", OrderStatus.class, steps -> ...)
.onUpdate("orders", "onChanged", steps -> ...)
.onUpdate("orders", "onShipped", OrderShipped.class, steps -> ...)
.onSessionCreated("orders", "onNewDoc", steps -> ...)

// accessLinked() listeners
.onLinkedAccessGranted("shopData", "onLinkedGranted", steps -> ...)
.onLinkedAccessRejected("shopData", "onLinkedRejected", steps -> ...)
.onLinkedAccessRevoked("shopData", "onLinkedRevoked", steps -> ...)
// optional aliases:
.onLinkedDocGranted("shopData", "onNewPurchase", steps -> ...)
.onLinkedDocRevoked("shopData", "onPurchaseRemoved", steps -> ...)

// agency() listeners
.onAgencyGranted("procurement", "onReady", steps -> ...)
.onAgencyRejected("procurement", "onDenied", steps -> ...)
.onAgencyRevoked("procurement", "onRevoked", steps -> ...)
.onSessionStarting("procurement", "onStarting", steps -> ...)
.onSessionStarted("procurement", "onReady", steps -> ...)
.onSessionFailed("procurement", "onFailed", steps -> ...)
.onParticipantResolved("procurement", "onParticipant", steps -> ...)
.onAllParticipantsReady("procurement", "onAllReady", steps -> ...)
```

All these are built on `onMyOsResponse` and `onSubscriptionUpdate` internally. Use the raw matchers from §6.2 if you need custom correlation logic.

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

### 7.3 Document interaction step helpers

Call operations on a document configured via `access()`:

```java
steps.access("orders").call("getStatus", null);
steps.access("orders").call("updateQuantity", quantityPayload);
steps.access("orders").callExpr("updateQuantity", "steps.Compute.result");
```

These auto-resolve `onBehalfOf` and `targetSessionId` from the named access configuration. Generates `Call Operation Requested`.

Start sessions via `agency()`:

```java
steps.viaAgency("procurement").startSession(
    "StartPurchase",
    purchaseDocNode,
    bindings -> bindings
        .bind("sellerChannel", "vendor@example.com")
        .bindFromCurrentDoc("buyerChannel", "userChannel"),
    options -> options
        .initiator("buyerChannel")
        .defaultMessage("You've been invited to negotiate.")
        .capabilities(caps -> caps.participantsOrchestration(true)));
```

Auto-resolves `onBehalfOf` from agency config. Generates `Start Worker Session Requested`.

Manual permission and subscription control:

```java
steps.access("orders").requestPermission();
steps.access("orders").requestPermission("RequestNow");
steps.access("orders").subscribe();
steps.access("orders").subscribe("SubscribeNow");
steps.access("orders").revokePermission();

steps.viaAgency("procurement").requestPermission();
steps.viaAgency("procurement").requestPermission("RequestAgency");
```

### 7.4 Step extensions

```java
steps.ext(MyCustomSteps::new).doSomething();
```

## 8) AI Integration DSL

AI integration is a first-class `DocBuilder` primitive.
Use `.ai(...)` directly on `DocBuilder` / `SimpleDocBuilder`; it is not nested under `.myOs()`.

### 8.1 Define integration

```java
.ai("provider")
    .sessionId(DocBuilder.expr("document('/llmProviderSessionId')"))
    .permissionFrom("ownerChannel")
    .statusPath("/provider/status")
    .contextPath("/provider/context")
    .requesterId("MEAL_PLANNER")
    .requestPermissionOnInit()
    .done()
```

Permission timing options (shared with `access()`, `accessLinked()`, `agency()`):

```java
.requestPermissionOnInit()                              // default
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
- `_SaveAIContext` → replace `<contextPath>` with `event.update.context`

### 8.5 Manual AI control from steps

```java
steps.ai("provider").requestPermission();
steps.ai("provider").requestPermission("RequestNow");
steps.ai("provider").subscribe();
steps.ai("provider").subscribe("SubscribeNow");
```

## 9) Document Interaction DSL

Three builders for document-to-document interaction. All follow the same permission lifecycle: request → granted/rejected → act → optionally revoke.

All auto-ensure `myOsAdmin()` is present.

### 9.1 `access()` — Interact with a Known Session

Read, call operations on, and optionally subscribe to another document session.

```java
.access("orders")
    .targetSessionId(expr("document('/ordersSessionId')"))
    .onBehalfOf("ownerChannel")
    .read(true)
    .operations("getStatus", "updateQuantity")
    .requestPermissionOnInit()
    .statusPath("/orders/accessStatus")
    .done()
```

With subscription (receive updates when target changes):

```java
.access("orders")
    .targetSessionId(expr("document('/ordersSessionId')"))
    .onBehalfOf("ownerChannel")
    .read(true)
    .operations("getStatus")
    .requestPermissionOnInit()
    .subscribeAfterGranted()
    .subscriptionEvents(SessionEpochAdvanced.class, OrderShipped.class)
    .statusPath("/orders/accessStatus")
    .done()
```

With factory operations (target creates new sessions you auto-subscribe to):

```java
.access("invoiceService")
    .targetSessionId("session-invoice-svc")
    .onBehalfOf("ownerChannel")
    .operations("createInvoice")
    .subscribeToCreatedSessions(true)
    .requestPermissionOnInit()
    .statusPath("/invoiceService/accessStatus")
    .done()
```

Auto-generated contracts per `access("orders")`:

| Contract key | Type | Trigger |
|---|---|---|
| `accessORDERSRequestPermission` | Sequential Workflow | Permission timing (init/event/docChange) |
| `accessORDERSGranted` | Sequential Workflow | `Single Document Permission Granted` with `REQ_ACCESS_ORDERS` |
| `accessORDERSRejected` | Sequential Workflow | `Single Document Permission Rejected` |
| `accessORDERSRevoked` | Sequential Workflow | `Single Document Permission Revoked` |
| `accessORDERSSubscriptionReady` | Sequential Workflow | `Subscription to Session Initiated` (if `subscribeAfterGranted`) |
| `accessORDERSSubscriptionFailed` | Sequential Workflow | `Subscription to Session Failed` (if `subscribeAfterGranted`) |

Notes:
- Token in generated keys is uppercase alphanumeric from the configured name (`orders` -> `ORDERS`).
- There is no separate `...Subscribe` workflow; subscribe is emitted as a step inside `...Granted`.

Status path transitions (when `statusPath` is configured): `pending` → `granted` / `rejected` → `subscribed` / `subscription-failed` → `revoked`

Step-level usage:

```java
steps.access("orders").call("getStatus", null);
steps.access("orders").call("updateQuantity", quantityNode);
steps.access("orders").callExpr("updateQuantity", "steps.Compute.result");
```

Listeners:

```java
.onAccessGranted("orders", "onGranted", steps -> ...)
.onAccessRejected("orders", "onRejected", steps -> ...)
.onAccessRevoked("orders", "onRevoked", steps -> ...)
.onCallResponse("orders", "onResult", steps -> ...)
.onCallResponse("orders", "onResult", OrderStatus.class, steps -> ...)
.onUpdate("orders", "onChanged", steps -> ...)
.onUpdate("orders", "onShipped", OrderShipped.class, steps -> ...)
.onSessionCreated("orders", "onNewDoc", steps -> ...)
```

### 9.2 `accessLinked()` — Access Documents Linked from a Target

Request permission for a dynamic collection of documents linked from an anchor session.

```java
.accessLinked("shopData")
    .targetSessionId(expr("document('/shopPortalSessionId')"))
    .onBehalfOf("orchestratorChannel")
    .link("purchases")
        .read(true)
        .operations("getReceipt")
        .done()
    .link("returns")
        .read(true)
        .done()
    .requestPermissionOnInit()
    .statusPath("/shopData/accessStatus")
    .done()
```

Auto-generated contracts follow the same pattern as `access()` but emit `Linked Documents Permission Grant Requested`.

Additional listeners for linked document lifecycle:

```java
.onLinkedAccessGranted("shopData", "onLinkedGranted", steps -> ...)
.onLinkedAccessRejected("shopData", "onLinkedRejected", steps -> ...)
.onLinkedAccessRevoked("shopData", "onLinkedRevoked", steps -> ...)
// optional aliases:
.onLinkedDocGranted("shopData", "onNewPurchase", steps -> ...)
.onLinkedDocRevoked("shopData", "onPurchaseRemoved", steps -> ...)
```

### 9.3 `agency()` — Start New Document Sessions

Request permission to autonomously create new document sessions on behalf of a user.

```java
.agency("procurement")
    .onBehalfOf("userChannel")
    .allowedTypes(Purchase.class, SupportTicket.class)
    .allowedOperations("proposeOffer", "addNote", "close")
    .requestPermissionOnInit()
    .statusPath("/agency/status")
    .done()
```

Auto-generated contracts:

| Contract key | Type | Trigger |
|---|---|---|
| `agencyPROCUREMENTRequestPermission` | Sequential Workflow | Permission timing |
| `agencyPROCUREMENTGranted` | Sequential Workflow | `Worker Agency Permission Granted` |
| `agencyPROCUREMENTRejected` | Sequential Workflow | `Worker Agency Permission Rejected` |
| `agencyPROCUREMENTRevoked` | Sequential Workflow | `Worker Agency Permission Revoked` |

Step-level usage:

```java
steps.viaAgency("procurement").startSession(
    "StartNegotiation",
    purchaseDocNode,
    bindings -> bindings
        .bind("sellerChannel", "vendor@example.com")
        .bindFromCurrentDoc("buyerChannel", "userChannel"),
    options -> options
        .initiator("buyerChannel")
        .defaultMessage("You've been invited to negotiate.")
        .capabilities(caps -> caps.participantsOrchestration(true)));
```

Bindings builder methods:

| Method | Mapping |
|---|---|
| `.bind(key, email)` | Channel bound by email |
| `.bindAccount(key, accountId)` | Channel bound by account ID |
| `.bindNode(key, channelNode)` | Exact channel node |
| `.bindExpr(key, expr)` | Runtime expression |
| `.bindFromCurrentDoc(key)` | Copy channel from this document (same key) |
| `.bindFromCurrentDoc(targetKey, sourceKey)` | Copy channel from this document (different key) |

Options builder methods:

| Method | Mapping |
|---|---|
| `.initiator(channelKey)` | `initiatorChannel` on the session |
| `.defaultMessage(text)` | Message sent to all participants |
| `.channelMessage(key, text)` | Per-channel custom message |
| `.capabilities(caps -> ...)` | Session capabilities |

Capabilities:

```java
caps.participantsOrchestration(true)  // allow dynamic participant management
```

Listeners:

```java
.onAgencyGranted("procurement", "onReady", steps -> ...)
.onAgencyRejected("procurement", "onDenied", steps -> ...)
.onAgencyRevoked("procurement", "onRevoked", steps -> ...)
.onSessionStarting("procurement", "onStarting", steps -> ...)
.onSessionStarted("procurement", "onReady", steps -> ...)
.onSessionFailed("procurement", "onFailed", steps -> ...)
.onParticipantResolved("procurement", "onParticipant", steps -> ...)
.onAllParticipantsReady("procurement", "onAllReady", steps -> ...)
```

### 9.4 Permission timing (shared across all interaction builders)

```java
.requestPermissionOnInit()                              // default
.requestPermissionOnEvent(AllParticipantsReady.class)   // on triggered event
.requestPermissionOnDocChange("/status")                // on document path change
.requestPermissionManually()                            // nothing auto-generated
```

For manual timing, trigger from steps:

```java
steps.access("orders").requestPermission();
steps.access("orders").requestPermission("RequestNow");  // custom step name
steps.viaAgency("procurement").requestPermission();
```

### 9.5 Revocation

From steps:

```java
steps.access("orders").revokePermission();
steps.access("orders").revokePermission("RevokeNow");
```

Listener:

```java
.onAccessRevoked("orders", "onRevoked", steps -> ...)
.onAgencyRevoked("procurement", "onAgencyRevoked", steps -> ...)
```

### 9.6 Relationship to `ai()` and low-level `steps.myOs()`

`ai()` is a specialized `access()` that adds subscription, task/prompt management, and context auto-save. Internally it follows the same permission lifecycle.

| Builder | Permission type | Step helper | Subscription | Extra features |
|---|---|---|---|---|
| `access()` | Single Document | `steps.access("x").call(...)` | Optional | Factory session subscribe |
| `accessLinked()` | Linked Documents | — | Via linked doc events | Multi-link support |
| `agency()` | Worker Agency | `steps.viaAgency("x").startSession(...)` | — | Session creation |
| `ai()` | Single Document | `steps.askAI("x", ...)` | Always | Tasks, prompts, context |

All four are built on `steps.myOs()` primitives. Use `steps.myOs()` directly only when the high-level builders don't cover your use case.

## 10) MyOS Extension (`steps.myOs()`)

Low-level MyOS interaction helpers. Prefer `access()`, `accessLinked()`, `agency()`, `ai()` builders when possible.

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

// optional overload: auto-grant session-subscription from permission results
steps.myOs().requestSingleDocPermission(
    "ownerChannel",
    "REQ_PROVIDER",
    DocBuilder.expr("document('/providerSessionId')"),
    MyOsPermissions.create().read(true),
    true);

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
steps.myOs().subscribeToSession("ownerChannel", "session-1", "SUB_1", CallOperationResponded.class);
steps.myOs().startWorkerSession("agentChannel", workerConfigNode);
```

Worker agency helpers:

```java
steps.myOs().grantWorkerAgencyPermission("ownerChannel", "REQ_W", permissionNode);
steps.myOs().grantWorkerAgencyPermission("ownerChannel", "REQ_W", "session-1", permissionNode);
steps.myOs().revokeWorkerAgencyPermission("ownerChannel", "REQ_W");
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

### 10.1 MyOsPermissions builder

```java
MyOsPermissions.create()
    .read(true)
    .write(false)
    .allOps(false)
    .singleOps("provideInstructions", "getStatus")
    .build();
```

## 11) Payment Request DSL

### 11.1 Entry methods

```java
steps.triggerPayment("RequestPayment", PaymentRequests.PaymentRequested.class, payload -> payload ...);
steps.triggerPayment(PaymentRequests.PaymentRequested.class, payload -> payload ...);

steps.requestBackwardPayment("VoucherCredit", payload -> payload ...);
steps.requestBackwardPayment(payload -> payload ...);
```

### 11.2 Core payload fields

```java
payload
    .processor("guarantorChannel")
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

### 11.3 Rail namespaces (`via*`)

```java
payload.viaAch().routingNumber("111000025").accountNumber("123456").accountType("checking").done();
payload.viaSepa().ibanFrom("DE123").ibanTo("DE456").done();
payload.viaWire().bankSwift("SWIFT").bankName("Bank").accountNumber("123").beneficiaryName("Jane").done();
payload.viaCard().cardOnFileRef("cof-1").merchantDescriptor("Blue Shop").done();
payload.viaTokenizedCard().networkToken("nt").tokenProvider("tp").cryptogram("cg").done();
payload.viaCreditLine().creditLineId("facility-1").merchantAccountId("m-1").cardholderAccountId("c-1").done();
payload.viaLedger().ledgerAccountFrom("from").ledgerAccountTo("to").memo("memo").done();
payload.viaCrypto().asset("BTC").chain("bitcoin").fromWalletRef("wallet").toAddress("bc1...").done();
```

Bean shortcuts: `payload.viaAch(achFields)`, `payload.viaCreditLine(clFields)`, etc.

Extension hooks:

```java
payload.rail(customRailBean);
payload.putCustom("customField", "value");
payload.putCustomExpression("customExpr", "document('/x')");
payload.ext(DemoBankPaymentFields::new).creditFacilityId("facility-42");
```

Validation: `processor(...)` is mandatory and cannot be set via `rail(...)` or `putCustom(...)`.

## 12) Bootstrap DSL

Generic bootstrap from `StepsBuilder`:

```java
steps.bootstrapDocument(
    "BootstrapDeal",
    childDocNode,
    Map.of("buyerChannel", "ownerChannel"),
    options -> options
        .assignee("myOsAdminChannel")
        .defaultMessage("A new deal has been created."));

steps.bootstrapDocumentExpr(
    "BootstrapFromTemplate",
    "document('/template')",
    Map.of("participantA", "aliceChannel"),
    options -> options.assignee("orchestratorChannel"));
```

Note: For documents using `agency()`, prefer `steps.viaAgency("name").startSession(...)` (§9.3) which adds agency-level validation and lifecycle tracking.

## 13) PayNote DSL

### 13.1 Create paynote

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

### 13.2 Action builders

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
    .requestPartialOnOperation("partialCapture", "guarantorChannel", "Partial", "event.message.request.amount")
    .requestPartialOnEvent(ShipmentConfirmed.class, "event.message.request.amount")
    .done()
```

Reserve and release use the same trigger API surface:

```java
.reserve() ... .done()
.release() ... .done()
```

Important: `release()` emits reservation-release requests (void/release of reserved funds), not refund of already captured funds.

Build-time validation: If action is `lockOnInit()`, at least one unlock path is required.

## 14) End-to-End Examples

### 14.1 Counter with sections

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
            .steps(steps -> steps.replaceExpression("Inc", "/counter",
                "document('/counter') + event.message.request"))
            .done()
    .endSection()
    .buildDocument();
```

### 14.2 AI integration + task + named response

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

### 14.3 Armchair + voucher + backward payment

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
                    .release().requestOnInit().done()
                    .buildDocument())))
    .buildDocument();
```

### 14.4 Remote access + subscription + agency

```java
Node orchestrator = DocBuilder.doc()
    .name("Procurement Orchestrator")
    .description("Accesses a catalog, uses AI to find deals, starts purchase negotiations.")

    .section("participants", "Participants", "User and admin")
        .channel("userChannel")
    .endSection()

    .section("state", "State", "Session references and tracking")
        .field("/catalogSessionId", "session-catalog-001")
        .field("/plannerSessionId", "session-planner-001")
        .field("/currentTask", "")
        .field("/negotiations/count", 0)
    .endSection()

    .section("capabilities", "Capabilities", "External access, AI, and agency")

        .access("catalog")
            .targetSessionId(expr("document('/catalogSessionId')"))
            .onBehalfOf("userChannel")
            .read(true)
            .operations("search", "getDetails")
            .requestPermissionOnInit()
            .subscribeAfterGranted()
            .statusPath("/catalog/status")
            .done()

        .ai("planner")
            .sessionId(expr("document('/plannerSessionId')"))
            .permissionFrom("userChannel")
            .task("findBestDeal")
                .instruction("Search catalog results and find the best deal.")
                .instruction("Consider price, reviews, and delivery time.")
                .expectsNamed("deal-found", "vendorEmail", "productId", "price")
                .done()
            .done()

        .agency("procurement")
            .onBehalfOf("userChannel")
            .allowedTypes(Purchase.class)
            .allowedOperations("proposeOffer", "accept", "reject")
            .requestPermissionOnInit()
            .statusPath("/agency/status")
            .done()

    .endSection()

    .section("workflow", "Workflow", "User request → catalog → AI → negotiate")

        .operation("findAndBuy")
            .channel("userChannel")
            .requestType(String.class)
            .description("Find and buy a product")
            .steps(steps -> steps
                .replaceExpression("SaveTask", "/currentTask", "event.message.request")
                .access("catalog").call("search", DocBuilder.expr("event.message.request")))
            .done()

        .onCallResponse("catalog", "onSearchResults",
            CallOperationResponded.class, steps -> steps
                .replaceExpression("SaveResults", "/catalog/lastResults", "event.message.response")
                .askAI("planner", "Analyze", ask -> ask
                    .task("findBestDeal")
                    .instruction("Results: ${document('/catalog/lastResults')}")
                    .instruction("User wants: ${document('/currentTask')}")))

        .onAIResponse("planner", "onDealFound", "deal-found", steps -> steps
            .replaceExpression("SaveDeal", "/lastDeal", "event.update.payload")
            .viaAgency("procurement").startSession(
                "StartPurchase",
                DocBuilder.doc()
                    .name("Auto-Purchase")
                    .type(Purchase.class)
                    .channel("buyerChannel")
                    .channel("sellerChannel")
                    .field("/maxPrice", DocBuilder.expr("event.update.payload.price"))
                    .buildDocument(),
                bindings -> bindings
                    .bindExpr("sellerChannel", "event.update.payload.vendorEmail")
                    .bindFromCurrentDoc("buyerChannel", "userChannel"),
                options -> options
                    .initiator("buyerChannel")
                    .defaultMessage("Purchase negotiation started.")))

        .onSessionStarted("procurement", "onNegotiationStarted", steps -> steps
            .replaceExpression("Track", "/negotiations/count",
                "document('/negotiations/count') + 1"))

    .endSection()

    .buildDocument();
```

## 15) Common Pitfalls

1. Missing `endSection()`: `buildDocument()` throws when section is still open.
2. Assuming operation impl always exists: `<key>Impl` appears only when `.steps(...)` is provided.
3. Missing `processor` in payment requests: `triggerPayment` / `requestBackwardPayment` throw.
4. Unknown AI integration/task: `askAI` / `onAIResponse` validate integration and task names.
5. Unknown access/agency name: `steps.access("x")` / `steps.viaAgency("x")` validate that the name was configured via `.access("x")` / `.agency("x")`.
6. Event helper without step name: `triggerEvent`, `emit`, `emitType`, `namedEvent` require explicit non-blank step names.
7. Confusing `release()` with refund: `release()` is reservation release (void held funds), not refund of captured funds.

## 16) API Checklist (Authoring)

- **Data**: `field`, `replace`, `remove`
- **Grouping**: `section`, `endSection`
- **Channels**: `channel`, `channels`, `compositeChannel`, `myOsAdmin`, `canEmit`
- **Operations**: `operation(...)` inline + builder form, `directChange`
- **Workflows**: `onInit`, `onEvent`, `onNamedEvent`, `onDocChange`, `onChannelEvent`
- **Matchers**: `onMyOsResponse`, `onSubscriptionUpdate`, `onTriggeredWithId`, `onTriggeredWithMatcher`
- **Steps**: `jsRaw`, `updateDocument`, `updateDocumentFromExpression`, `triggerEvent`, `emit`, `emitType`, `namedEvent`, `capture`, `replaceValue`, `replaceExpression`
- **AI**: `ai().done()`, `steps.askAI()`, `onAIResponse()`, `steps.ai().requestPermission/subscribe`
- **Document interaction**: `access().done()`, `accessLinked().done()`, `agency().done()`
- **Interaction steps**: `steps.access("x").call()`, `steps.viaAgency("x").startSession()`
- **Interaction listeners**: `onAccessGranted/Rejected/Revoked`, `onCallResponse`, `onUpdate`, `onSessionCreated`, `onLinkedAccessGranted/Rejected/Revoked`, optional `onLinkedDocGranted/Revoked`, `onAgencyGranted/Rejected/Revoked`, `onSessionStarting/Started/Failed`, `onParticipantResolved`, `onAllParticipantsReady`
- **MyOS low-level**: `steps.myOs().<requests>`
- **Payments**: `triggerPayment`, `requestBackwardPayment`, `via*` rails
- **Bootstrap**: `steps.bootstrapDocument`, `steps.viaAgency("x").startSession()`
- **PayNote**: `PayNotes.payNote().capture/reserve/release`
