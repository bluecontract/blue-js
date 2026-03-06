# SDK DSL Mapping Audit Reference

This document is the node-shape specification for the runtime DSL.
It focuses on mappings only: input expression -> generated `Node` shape.

Scope:
- `blue.language.sdk.DocBuilder`
- `blue.language.sdk.internal.StepsBuilder`
- `blue.language.sdk.MyOsSteps`
- `blue.language.sdk.paynote.PayNoteBuilder`

## 1) Conventions

- `<k>` means a user-provided key.
- `${...}` means expression value stored as text expression.
- `<Type(X)>` means type resolved from `Class<?>` via `TypeRef.of(X)`.
- Paths are JSON-pointer style (`/contracts/...`, `/amount/total`, etc.).

Default channel invariant:

```yaml
contracts:
  ownerChannel:
    type: Core/Channel
```

## 2) Doc Root Mappings

### 2.1 Identity and Type

Expression:
- `.name("Counter")`
- `.description("Simple counter")`
- `.type("MyOS/Agent")`
- `.type(SomeClass.class)`

Mapping:

```yaml
name: Counter
description: Simple counter
type: MyOS/Agent
```

Class-based type mapping:

```yaml
type: <Type(SomeClass)>
```

### 2.2 Field Writes

Expression:
- `.field("/counter", 0)`

Mapping:

```yaml
counter: 0
```

Expression:
- `.replace("/status", "ready")`

Mapping:

```yaml
status: ready
```

Expression:
- `.remove("/obsolete")`

Mapping effect:
- Removes `/obsolete` if present.

Pointer rules:
- Missing containers are created.
- Root pointer (`/`) is rejected for write/remove.
- Array traversal requires numeric segments.

## 3) Contract Mappings (DocBuilder)

### 3.1 Channels

Expression:
- `.channel("ownerChannel")`

Mapping:

```yaml
contracts:
  ownerChannel:
    type: Core/Channel
```

Expression:
- `.channels("a", "b")`

Mapping:

```yaml
contracts:
  a:
    type: Core/Channel
  b:
    type: Core/Channel
```

Expression:
- `.compositeChannel("ab", "a", "b")`

Mapping:

```yaml
contracts:
  ab:
    type: Conversation/Composite Timeline Channel
    channels:
      - a
      - b
```

Expression:
- `.channel("myOsAdminChannel", bean)`

Mapping:
- Bean converted with `Blue.objectToNode(bean)`.
- Empty `event` property is pruned when structurally empty.
- Final `/contracts/myOsAdminChannel/type` forced from bean class type.

### 3.2 Sections (`Conversation/Document Section`)

Expression:

```java
.section("counterOps", "Counter operations", "Increment/decrement")
    .field("/counter", 0)
    .operation("increment", "ownerChannel", "Inc")
.endSection()
```

Mapping:

```yaml
contracts:
  counterOps:
    type: Conversation/Document Section
    title: Counter operations
    summary: Increment/decrement
    relatedFields:
      - /counter
    relatedContracts:
      - increment
```

Expression:
- `.section("counterOps") ... .endSection()`

Mapping:
- Reopens existing section contract, appends tracked members, preserves existing metadata unless explicitly changed by section contract edits.

### 3.3 Operations

Expression:
- `.operation("increment", "ownerChannel", "Increment")`

Mapping:

```yaml
contracts:
  increment:
    type: Conversation/Operation
    channel: ownerChannel
    description: Increment
```

Expression:
- `.operation("increment", "ownerChannel", Integer.class, "Increment")`

Mapping:

```yaml
contracts:
  increment:
    type: Conversation/Operation
    channel: ownerChannel
    description: Increment
    request:
      type: <Type(Integer.class)>
```

Expression:
- `.operation("increment", "ownerChannel", "Increment", steps -> ...)`

Mapping:

```yaml
contracts:
  increment:
    type: Conversation/Operation
    channel: ownerChannel
    description: Increment
  incrementImpl:
    type: Conversation/Sequential Workflow Operation
    operation: increment
    steps: [ ... ]
```

Expression:
- `.operation("increment", "ownerChannel", Integer.class, "Increment", steps -> ...)`

Mapping:
- Same as above plus `request.type`.

Operation builder mapping (`.operation("k") ... .done()`):

```yaml
contracts:
  k:
    type: Conversation/Operation
    channel: <required>
    description: <optional>
    request: <from requestType/request/noRequest>
  kImpl: # only when .steps(...) used
    type: Conversation/Sequential Workflow Operation
    operation: k
    steps: [ ... ]
```

Request schema variants:
- `.requestType(C.class)` -> `request.type = <Type(C)>`
- `.request(nodeOrBean)` -> full `request` object set from node/bean
- `.requestDescription("...")` -> `request.description = ...`
- `.noRequest()` -> removes `request`

### 3.4 Request Description Helper

Expression:
- `.requestDescription("increment", "Represents delta")`

Mapping:

```yaml
contracts:
  increment:
    request:
      description: Represents delta
```

### 3.5 Workflow Contracts

Expression:
- `.onInit("wf", steps -> ...)`

Mappings:

```yaml
contracts:
  initLifecycleChannel:
    type: Lifecycle Event Channel
    event:
      type: Document Processing Initiated
  wf:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps: [ ... ]
```

Expression:
- `.onEvent("wf", EventClass.class, steps -> ...)`

Mappings:

```yaml
contracts:
  triggeredEventChannel:
    type: Triggered Event Channel
  wf:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: <Type(EventClass)>
    steps: [ ... ]
```

Expression:
- `.onNamedEvent("wf", "shipment-confirmed", steps -> ...)`

Mapping:

```yaml
contracts:
  wf:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: Common/Named Event
      name: shipment-confirmed
    steps: [ ... ]
```

Expression:
- `.onChannelEvent("wf", "ownerChannel", EventClass.class, steps -> ...)`

Mapping:

```yaml
contracts:
  wf:
    type: Conversation/Sequential Workflow
    channel: ownerChannel
    event:
      type: <Type(EventClass)>
    steps: [ ... ]
```

Expression:
- `.onDocChange("wf", "/counter", steps -> ...)`

Mappings:

```yaml
contracts:
  wfDocUpdateChannel:
    type: Document Update Channel
    path: /counter
  wf:
    type: Conversation/Sequential Workflow
    channel: wfDocUpdateChannel
    event:
      type: Document Update
    steps: [ ... ]
```

### 3.6 Triggered Matcher Helpers

Expression:
- `.onTriggeredWithId("wf", Resp.class, "requestId", "REQ_1", steps -> ...)`

Mapping:

```yaml
contracts:
  wf:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: <Type(Resp)>
      requestId: REQ_1
      inResponseTo:
        requestId: REQ_1
```

Expression:
- `.onTriggeredWithId("wf", E.class, "subscriptionId", "SUB_1", ...)`

Mapping:

```yaml
event:
  type: <Type(E)>
  subscriptionId: SUB_1
```

Expression:
- `.onTriggeredWithMatcher("wf", E.class, matcherBean, steps -> ...)`

Mapping:
- `matcherBean` converted with `Blue.objectToNode(...)`.
- `event.type` forced to `<Type(E)>`.

### 3.7 MyOS Response Helpers

Expression:
- `.onMyOsResponse("wf", Resp.class, "REQ_1", steps -> ...)`

Mapping:
- Equivalent to `onTriggeredWithId(..., "requestId", "REQ_1", ...)`.

Expression:
- `.onMyOsResponse("wf", Resp.class, steps -> ...)`

Mapping:

```yaml
event:
  type: <Type(Resp)>
```

### 3.8 Subscription Update Helpers

Expression:
- `.onSubscriptionUpdate("wf", "SUB_1", Update.class, steps -> ...)`

Mapping:

```yaml
event:
  type: MyOS/Subscription Update
  subscriptionId: SUB_1
  update:
    type: <Type(Update.class)>
```

Expression:
- `.onSubscriptionUpdate("wf", "SUB_1", steps -> ...)`

Mapping:

```yaml
event:
  type: MyOS/Subscription Update
  subscriptionId: SUB_1
```

### 3.9 MyOS Admin + Emit Operations

Expression:
- `.myOsAdmin()`

Mappings:

```yaml
contracts:
  myOsAdminChannel:
    type: MyOS/MyOS Timeline
  myOsEmit:
    type: Conversation/Operation
    channel: myOsAdminChannel
    request:
      type: List
  myOsEmitImpl:
    type: Conversation/Sequential Workflow Operation
    operation: myOsEmit
    steps:
      - name: EmitEvents
        type: Conversation/JavaScript Code
        code: return { events: event };
```

Expression:
- `.myOsAdmin("adminChannel")`

Mapping:
- Same structure, with channel key `adminChannel` and derived operation key:
  - if key ends with `Channel`: `<prefix>Emit` (for example `adminChannel` -> `adminEmit`)
  - else `<key>Emit`

Expression:
- `.canEmit("aliceChannel")`

Mapping:
- Adds `aliceEmit` + `aliceEmitImpl` as above.

Expression:
- `.canEmit("bobChannel", Ev1.class, Ev2.class)`

Mapping:

```yaml
contracts:
  bobEmit:
    request:
      type: List
      items:
        - type: <Type(Ev1)>
        - type: <Type(Ev2)>
```

Expression:
- `.canEmit("celineChannel", obj1, obj2)`

Mapping:

```yaml
contracts:
  celineEmit:
    request:
      type: List
      items:
        - <Blue.objectToNode(obj1)>
        - <Blue.objectToNode(obj2)>
```

## 4) AI DSL Mappings

### 4.1 Integration Registration

Expression:

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

Mappings:

```yaml
provider:
  status: pending
  context: {}
contracts:
  aiPROVIDERRequestPermission:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - type: Conversation/Trigger Event
        event:
          type: MyOS/Single Document Permission Grant Requested
          onBehalfOf: ownerChannel
          requestId: REQ_PROVIDER
          targetSessionId: ${document('/llmProviderSessionId')}
          permissions:
            read: true
            singleOps:
              - provideInstructions
  aiPROVIDERSubscribe:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Single Document Permission Granted
      requestId: REQ_PROVIDER
      inResponseTo:
        requestId: REQ_PROVIDER
    steps:
      - type: Conversation/Trigger Event
        event:
          type: MyOS/Subscribe to Session Requested
          onBehalfOf: ownerChannel
          targetSessionId: ${document('/llmProviderSessionId')}
          subscription:
            id: SUB_PROVIDER
            events: []
  aiPROVIDERSubscriptionReady:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Subscription Update
      subscriptionId: SUB_PROVIDER
      update:
        type: MyOS/Subscription To Session Initiated
    steps:
      - type: Conversation/Update Document
        changeset:
          - op: replace
            path: /provider/status
            val: ready
  aiPROVIDERPermissionRejected:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Single Document Permission Rejected
      requestId: REQ_PROVIDER
      inResponseTo:
        requestId: REQ_PROVIDER
    steps:
      - type: Conversation/Update Document
        changeset:
          - op: replace
            path: /provider/status
            val: revoked
```

Permission timing variations:
- `requestPermissionOnEvent(E.class)` -> `ai<TOKEN>RequestPermission` bound to `triggeredEventChannel` with `event.type = <Type(E)>`.
- `requestPermissionOnDocChange("/path")` -> `ai<TOKEN>RequestPermissionDocUpdateChannel` + workflow on that channel.
- `requestPermissionManually()` -> omits `ai<TOKEN>RequestPermission` workflow.

### 4.2 askAI Mapping

Expression:

```java
steps.askAI("provider", "GeneratePlan", ask -> ask
    .task("summarize")
    .instruction("Request: ${event.message.request}")
    .expectsNamed("meal-plan-ready", "planId"))
```

Mapping:

```yaml
- name: GeneratePlan
  type: Conversation/Trigger Event
  event:
    type: MyOS/Call Operation Requested
    onBehalfOf: <integration.permissionFrom>
    targetSessionId: <integration.sessionId>
    operation: provideInstructions
    request:
      requester: <integration.requesterId>
      context: ${document('<integration.contextPath>')}
      instructions: <merged prompt expression>
      taskName: summarize # optional
      expectedResponses: # optional
        - <typed expectations from task and inline>
        - type: Common/Named Event
          name: meal-plan-ready
          payload:
            planId: {}
```

Notes:
- Task expectations + inline expectations are merged and de-duplicated.
- `steps.askAI("name", ask -> ...)` uses default step name `AskAI`.

### 4.3 onAIResponse Mapping

Typed response expression:

```java
.onAIResponse("provider", "onPlan", ConversationResponse.class, steps -> ...)
```

Mapping:

```yaml
contracts:
  onPlan:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: MyOS/Subscription Update
      subscriptionId: SUB_PROVIDER
      update:
        type: Conversation/Response
        inResponseTo:
          incomingEvent:
            requester: <integration.requesterId>
    steps:
      - name: _SaveAIContext
        type: Conversation/Update Document
        changeset:
          - op: replace
            path: <integration.contextPath>
            val: ${event.update.context}
      - <user steps...>
```

Task-filtered typed response expression:

```java
.onAIResponse("provider", "onSummary", ConversationResponse.class, "summarize", steps -> ...)
```

Additional matcher:

```yaml
event:
  update:
    inResponseTo:
      incomingEvent:
        taskName: summarize
```

Named-event response expression:

```java
.onAIResponse("provider", "onReady", "meal-plan-ready", steps -> ...)
```

Mapping:

```yaml
event:
  type: MyOS/Subscription Update
  subscriptionId: SUB_PROVIDER
  update:
    type: Common/Named Event
    name: meal-plan-ready
```

### 4.4 Manual AI Step Namespace

Expression:
- `steps.ai("provider").requestPermission("Req")`

Mapping:

```yaml
- name: Req
  type: Conversation/Trigger Event
  event:
    type: MyOS/Single Document Permission Grant Requested
    onBehalfOf: <integration.permissionFrom>
    requestId: REQ_<TOKEN>
    targetSessionId: <integration.sessionId>
    permissions:
      read: true
      singleOps:
        - provideInstructions
```

Expression:
- `steps.ai("provider").subscribe("Sub")`

Mapping:

```yaml
- name: Sub
  type: Conversation/Trigger Event
  event:
    type: MyOS/Subscribe to Session Requested
    onBehalfOf: <integration.permissionFrom>
    targetSessionId: <integration.sessionId>
    subscription:
      id: SUB_<TOKEN>
      events: []
```

## 5) StepsBuilder Mappings

### 5.1 Core Step Nodes

Expression:
- `.jsRaw("Compute", "return { done: true };")`

Mapping:

```yaml
- name: Compute
  type: Conversation/JavaScript Code
  code: return { done: true };
```

Expression:
- `.updateDocument("Apply", cs -> cs.replaceValue("/status", "ready"))`

Mapping:

```yaml
- name: Apply
  type: Conversation/Update Document
  changeset:
    - op: replace
      path: /status
      val: ready
```

Expression:
- `.updateDocumentFromExpression("Apply", "steps.Compute.changeset")`

Mapping:

```yaml
- name: Apply
  type: Conversation/Update Document
  changeset: ${steps.Compute.changeset}
```

### 5.2 Event Emission (5 methods)

Expression:
- `.triggerEvent("EmitX", node)`

Mapping:

```yaml
- name: EmitX
  type: Conversation/Trigger Event
  event: <node>
```

Expression:
- `.emit("EmitX", bean)`

Mapping:

```yaml
- name: EmitX
  type: Conversation/Trigger Event
  event: <Blue.objectToNode(bean)>
```

Expression:
- `.emitType("EmitX", Event.class, payload -> payload.put("k", "v"))`

Mapping:

```yaml
- name: EmitX
  type: Conversation/Trigger Event
  event:
    type: <Type(Event.class)>
    k: v
```

Expression:
- `.namedEvent("EmitStatus", "order-confirmed", payload -> payload.put("orderId", "123"))`

Mapping:

```yaml
- name: EmitStatus
  type: Conversation/Trigger Event
  event:
    type: Common/Named Event
    name: order-confirmed
    payload:
      orderId: "123"
```

Expression:
- `.namedEvent("EmitDone", "processing-complete")`

Mapping:

```yaml
- name: EmitDone
  type: Conversation/Trigger Event
  event:
    type: Common/Named Event
    name: processing-complete
```

Validation:
- `triggerEvent`, `emit`, `emitType`, and `namedEvent` require non-blank step names.

### 5.3 Convenience Document Updates

Expression:
- `.replaceValue("R", "/x", 1)`

Mapping:

```yaml
- name: R
  type: Conversation/Update Document
  changeset:
    - op: replace
      path: /x
      val: 1
```

Expression:
- `.replaceExpression("R", "/x", "document('/y') + 1")`

Mapping:

```yaml
- name: R
  type: Conversation/Update Document
  changeset:
    - op: replace
      path: /x
      val: ${document('/y') + 1}
```

### 5.4 Bootstrap Step Mapping

Expression:
- `.bootstrapDocument("Bootstrap", childNode, bindings)`

Mapping:

```yaml
- name: Bootstrap
  type: Conversation/Trigger Event
  event:
    type: Conversation/Document Bootstrap Requested
    document: <childNode>
    channelBindings: <bindings map>
```

Expression:
- `.bootstrapDocumentExpr("Bootstrap", "document('/template')", bindings, options)`

Mapping:

```yaml
- name: Bootstrap
  type: Conversation/Trigger Event
  event:
    type: Conversation/Document Bootstrap Requested
    document: ${document('/template')}
    channelBindings: <bindings map>
    bootstrapAssignee: <optional>
    initialMessages:
      defaultMessage: <optional>
      perChannel:
        <k>: <message>
```

### 5.5 Payment Request Mapping

Expression:
- `.triggerPayment("Pay", PaymentRequested.class, payload -> ...)`

Mapping:

```yaml
- name: Pay
  type: Conversation/Trigger Event
  event:
    type: <Type(PaymentRequested.class)>
    processor: <required>
    payer: <optional>
    payee: <optional>
    from: <optional>
    to: <optional>
    currency: <optional>
    amountMinor: <value or ${expr}>
    reason: <optional>
    attachedPayNote: <optional node>
    # rail-specific optional fields merged below
```

Expression:
- `.triggerPayment(PaymentRequested.class, payload -> ...)`

Mapping:
- Same as above with default step name `TriggerPayment`.

Expression:
- `.requestBackwardPayment("VoucherCredit", payload -> ...)`

Mapping:

```yaml
- name: VoucherCredit
  type: Conversation/Trigger Event
  event:
    type: PayNote/Backward Payment Requested
    processor: <required>
    from: <optional>
    to: <optional>
    currency: <optional>
    amountMinor: <optional>
    reason: <optional>
    attachedPayNote: <optional>
```

Expression:
- `.requestBackwardPayment(payload -> ...)`

Mapping:
- Same as above with default step name `RequestBackwardPayment`.

Rail namespace mappings (all optional):

```yaml
# viaAch()
routingNumber: ...
accountNumber: ...
accountType: ...
network: ...
companyEntryDescription: ...

# viaSepa()
ibanFrom: ...
ibanTo: ...
bicTo: ...
remittanceInformation: ...

# viaWire()
bankSwift: ...
bankName: ...
accountNumber: ...
beneficiaryName: ...
beneficiaryAddress: ...

# viaCard()
cardOnFileRef: ...
merchantDescriptor: ...

# viaTokenizedCard()
networkToken: ...
tokenProvider: ...
cryptogram: ...

# viaCreditLine()
creditLineId: ...
merchantAccountId: ...
cardholderAccountId: ...

# viaLedger()
ledgerAccountFrom: ...
ledgerAccountTo: ...
memo: ...

# viaCrypto()
asset: ...
chain: ...
fromWalletRef: ...
toAddress: ...
txPolicy: ...
```

Validation:
- `processor` is mandatory in payment payload.
- `putCustom("processor", ...)` and `rail(bean)` with `processor` are rejected.

### 5.6 Capture Namespace (`steps.capture()`)

Expression -> mapping:

```yaml
# lock()
- type: Conversation/Trigger Event
  event:
    type: PayNote/Card Transaction Capture Lock Requested

# unlock()
- type: Conversation/Trigger Event
  event:
    type: PayNote/Card Transaction Capture Unlock Requested

# markLocked()
- type: Conversation/Trigger Event
  event:
    type: PayNote/Card Transaction Capture Locked

# markUnlocked()
- type: Conversation/Trigger Event
  event:
    type: PayNote/Card Transaction Capture Unlocked

# requestNow()
- type: Conversation/Trigger Event
  event:
    type: PayNote/Capture Funds Requested
    amount: ${document('/amount/total')}

# requestPartial("expr")
- type: Conversation/Trigger Event
  event:
    type: PayNote/Capture Funds Requested
    amount: ${expr}

# releaseFull()
- type: Conversation/Trigger Event
  event:
    type: PayNote/Reservation Release Requested
    amount: ${document('/amount/total')}
```

### 5.7 Changeset Guardrails

Reserved processor contract paths are rejected by `ChangesetBuilder`:
- `/contracts/checkpoint`
- `/contracts/embedded`
- `/contracts/initialized`
- `/contracts/terminated`

## 6) MyOsSteps Mappings

All methods emit `Conversation/Trigger Event` steps with specific MyOS event payloads.

Expression:
- `steps.myOs().requestSingleDocPermission(onBehalfOf, requestId, targetSessionId, permissions)`

```yaml
event:
  type: MyOS/Single Document Permission Grant Requested
  onBehalfOf: <onBehalfOf>
  requestId: <requestId>
  targetSessionId: <targetSessionId>
  permissions: <node>
```

Expression:
- `requestLinkedDocsPermission(onBehalfOf, requestId, targetSessionId, links)`

```yaml
event:
  type: MyOS/Linked Documents Permission Grant Requested
  onBehalfOf: <onBehalfOf>
  requestId: <requestId>
  targetSessionId: <targetSessionId>
  links: <dictionary>
```

Expression:
- `revokeSingleDocPermission(...)`

```yaml
event:
  type: MyOS/Single Document Permission Revoke Requested
  onBehalfOf: <onBehalfOf>
  requestId: <requestId>
  targetSessionId: <targetSessionId>
```

Expression:
- `revokeLinkedDocsPermission(...)`

```yaml
event:
  type: MyOS/Linked Documents Permission Revoke Requested
  onBehalfOf: <onBehalfOf>
  requestId: <requestId>
  targetSessionId: <targetSessionId>
```

Expression:
- `addParticipant(channelKey, email)`

```yaml
event:
  type: MyOS/Adding Participant Requested
  channelKey: <channelKey>
  email: <email>
```

Expression:
- `removeParticipant(channelKey)`

```yaml
event:
  type: MyOS/Removing Participant Requested
  channelKey: <channelKey>
```

Expression:
- `callOperation(onBehalfOf, targetSessionId, operation, request)`

```yaml
event:
  type: MyOS/Call Operation Requested
  onBehalfOf: <onBehalfOf>
  targetSessionId: <targetSessionId>
  operation: <operation>
  request: <optional>
```

Expression:
- `subscribeToSession(onBehalfOf, targetSessionId, subscriptionId)`

```yaml
event:
  type: MyOS/Subscribe to Session Requested
  onBehalfOf: <onBehalfOf>
  targetSessionId: <targetSessionId>
  subscription:
    id: <subscriptionId>
    events: []
```

Expression:
- `startWorkerSession(agentChannelKey, config)`

```yaml
event:
  type: MyOS/Start Worker Session Requested
  agentChannelKey: <agentChannelKey>
  config: <config node>
```

Expression:
- `grantWorkerAgencyPermission(...)`

```yaml
event:
  type: MyOS/Worker Agency Permission Grant Requested
  onBehalfOf: <onBehalfOf>
  requestId: <requestId>
  targetSessionId: <targetSessionId>
  workerAgencyPermissions: <node>
```

Expression:
- `revokeWorkerAgencyPermission(...)`

```yaml
event:
  type: MyOS/Worker Agency Permission Revoke Requested
  onBehalfOf: <onBehalfOf>
  requestId: <requestId>
  targetSessionId: <targetSessionId>
```

Expression:
- `bootstrapDocument(stepName, document, bindings[, options])`

Mapping:
- Delegates to `StepsBuilder.bootstrapDocument(...)`.
- `bootstrapAssignee` defaults to `MyOsSteps.adminChannelKey`, unless overridden in options.

## 7) PayNoteBuilder Mappings

### 7.1 PayNote Initialization

Expression:

```java
PayNotes.payNote("Armchair")
```

Mapping:

```yaml
name: Armchair
type: PayNote/Pay Note
contracts:
  payerChannel:
    type: Core/Channel
  payeeChannel:
    type: Core/Channel
  guarantorChannel:
    type: Core/Channel
```

### 7.2 Currency and Amount

Expression:
- `.currency("USD")` -> `/currency: USD`
- `.amountMinor(10000)` -> `/amount/total: 10000`
- `.amountMajor("100.00")` -> `/amount/total` converted with currency fraction digits.

### 7.3 Capture/Reserve/Release Action Builders

Actions generate workflow contracts with deterministic keys.

`capture()` mappings:

```yaml
# lockOnInit()
contracts:
  captureLockOnInit:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - type: Conversation/Trigger Event
        event:
          type: PayNote/Card Transaction Capture Lock Requested

# unlockOnEvent(FundsCaptured.class)
contracts:
  captureUnlockOnFundsCaptured:
    type: Conversation/Sequential Workflow
    channel: triggeredEventChannel
    event:
      type: <Type(FundsCaptured.class)>
    steps:
      - type: Conversation/Trigger Event
        event:
          type: PayNote/Card Transaction Capture Unlock Requested

# requestOnInit()
contracts:
  captureRequestOnInit:
    type: Conversation/Sequential Workflow
    channel: initLifecycleChannel
    steps:
      - type: Conversation/Trigger Event
        event:
          type: PayNote/Capture Funds Requested
          amount: ${document('/amount/total')}
```

`reserve()` mappings:

```yaml
# lockOnInit()
steps:
  - event.type: PayNote/Reserve Lock Requested

# unlockOnEvent(...)
steps:
  - event.type: PayNote/Reserve Unlock Requested

# requestOnInit()
steps:
  - event.type: PayNote/Reserve Funds Requested
    event.amount: ${document('/amount/total')}
```

`release()` mappings:

```yaml
# lockOnInit()
steps:
  - event.type: PayNote/Reservation Release Lock Requested

# unlockOnEvent(...)
steps:
  - event.type: PayNote/Reservation Release Unlock Requested

# requestOnInit()
steps:
  - event.type: PayNote/Reservation Release Requested
    event.amount: ${document('/amount/total')}
```

Operation-triggered action expressions (`unlockOnOperation`, `requestOnOperation`, `requestPartialOnOperation`) map to:

```yaml
contracts:
  <operationKey>:
    type: Conversation/Operation
    channel: <channelKey>
    description: <description>
  <operationKey>Impl:
    type: Conversation/Sequential Workflow Operation
    operation: <operationKey>
    steps:
      - <optional extra steps>
      - <action event step>
```

Validation:
- If an action is `lockOnInit()`, at least one unlock path must be configured for that action before `buildDocument()`.

## 8) Key Generation Rules

- Operation implementation key: `<operationKey>Impl`
- `onDocChange("wf", ...)` channel key: `wfDocUpdateChannel`
- AI workflow prefix: `ai<TOKEN>` where `TOKEN` is uppercase alnum integration name.
- AI request/subscription IDs:
  - `requestId = REQ_<TOKEN>`
  - `subscriptionId = SUB_<TOKEN>`
- `canEmit("xChannel")` operation key:
  - if ends with `Channel`: `<prefix>Emit`
  - else `<key>Emit`
