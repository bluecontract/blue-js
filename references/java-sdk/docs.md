# Blue Java SDK — Latest DX Guide

This repo now keeps **one latest SDK surface** (no `v1` / `v2` / `vnext` package usage for authoring).

## Runtime baseline

- Java 17 is required for local development, CI build, and release pipelines.

## Where to start

### 1) Generic document builder (non-PayNote)

Use `SimpleDocBuilder` (base class is `DocBuilder`):

- `src/test/java/blue/language/samples/paynote/sdk/DocBuilder.java`
- `src/test/java/blue/language/samples/paynote/sdk/SimpleDocBuilder.java`
- `src/test/java/blue/language/samples/paynote/sdk/SimpleDocBuilderTest.java`

Example shape:

```java
Node doc = SimpleDocBuilder.name("Counter #1")
  .type("MyCompany/Counter")
  .description("Demo counter")
  .participants("owner", "observer")
  .set("/count", 0)
  .operation("increment")
    .channel("owner")
    .requestType(Integer.class)
    .steps(steps -> steps.replaceExpression("Inc", "/count", "document('/count') + event.message.request"))
    .done()
  .buildDocument();
```

Then bind identities at bootstrap time:

```java
Node bootstrap = MyOsDsl.bootstrap(doc)
  .bind("owner").email("alice@gmail.com")
  .bind("observer").accountId("acc_observer_123")
  .build();
```

---

## PayNote SDK (capture-first, rail-agnostic)

Use:

- `src/test/java/blue/language/samples/paynote/sdk/PayNotes.java`
- `src/test/java/blue/language/samples/paynote/sdk/PayNoteBuilder.java`
- `src/test/java/blue/language/samples/paynote/sdk/PayNoteBuilderTest.java`

### Key DX features

- `PayNotes.payNote("...")` is primary.
- Currency is enum: `IsoCurrency`.
- Amount ergonomics:
  - `amountTotalMinor(long)`
  - `amountTotalMajor(BigDecimal/String)` with strict scale validation.
- Payer/Payee/Guarantor are implicit.
- Participants are channel keys:
  - `participant("shipmentCompanyChannel")`
  - `participant("shipmentCompanyChannel", "Shipment company")`
  - `participant("shipmentCompanyChannel", "Shipment company", myOsChannelNode)`
  - `participants("a", "b", "c")`
- Capture helpers use capture terminology only:
  - `capture().lockOnInit()`
  - `capture().lockOnEvent(...)`
  - `capture().lockOnOperation(...)`
  - `capture().lockOnDocPathChange(...)`
  - `capture().unlockOnEvent(...)`
  - `capture().unlockOnOperation(...)`
  - `capture().unlockOnDocPathChange(...)`
  - `capture().requestOnInit()`
  - `capture().requestOnEvent(...)`
  - `capture().requestOnOperation(...)`
  - `capture().requestOnDocPathChange(...)`
  - `capture().requestPartialOnEvent(..., amountExpression)`
  - `capture().requestPartialOnOperation(..., amountExpression, op -> ...)`
  - `capture().requestPartialOnDocPathChange(..., amountExpression)`
  - `capture().refundOnEvent(...)`
  - `capture().refundOnOperation(...)`
  - `capture().refundOnDocPathChange(...)`
  - `capture().refundPartialOnEvent(..., amountExpression)`
  - `capture().refundPartialOnOperation(..., amountExpression, op -> ...)`
  - `capture().refundPartialOnDocPathChange(..., amountExpression)`
  - no duplicate alias surface (`unlockExternal...`, `requestCapture...`) is needed anymore.
- Participant event ingress:
  - `acceptsEventsFrom("inspector")`
  - `acceptsEventsFrom("guarantor", AllowedEventA.class, AllowedEventB.class)`
  - atomic one-liners like `captureLockedUntilOperation(...)`.
- Reserve/refund helper symmetry:
  - `reserveLockedUntilOperation(...)`, `reserveLockedUntilEvent(...)`, `reserveLockedUntilDocPathChanges(...)`
  - `refundLockedUntilOperation(...)`, `refundLockedUntilEvent(...)`, `refundLockedUntilDocPathChanges(...)`
- Payment event trigger helper:
  - `steps.triggerPayment(PaymentType.class, pay -> pay
      .processor("...")
      .payer("...")
      .payee("...")
      .currency("USD")
      .amountMinor(1000)
      .attachPayNote(template))`
  - typed payload builder also supports ACH/SEPA/wire/card/token/credit-line/internal-ledger/crypto subtype fields.
  - validates required `processor` field at authoring time.
- Document authoring is separate from bootstrap bindings.
- Lock plans fail fast if no unlock path is configured.

---

## Complexity ladder

See:

- `src/test/java/blue/language/samples/paynote/examples/PayNoteComplexityLadderExamples.java`
- `src/test/java/blue/language/samples/paynote/examples/PayNoteComplexityLadderExamplesTest.java`

### Step 1 — tiny useful paynotes (5–10 lines)

- `tinyCaptureAfterShipmentOp()`
- `tinyCaptureAfterBuyerApprovalOp()`
- `tinyCaptureAfterTrackingChange()`
- `tinyCaptureAfterEvent()`
- `tinyReserveThenCaptureOnEvent()`
- `tinyRefundOperation()`
- `tinyReleaseOperation()`
- `tinyCancellationOperation()`

### Step 2 — medium paynote with custom operations

- `mediumShipmentEscrow()`

### Step 3 — large deterministic JS step (~100+ lines)

- `hugeJsRiskReview()`

---

## Class extension flow (`MyPayNote`)

See:

- `src/test/java/blue/language/samples/paynote/examples/MyPayNote.java`

It shows:

1. Define a base PayNote with shared fields/ops (`base(...)`).
2. Reuse and extend it (`withExtraOperations(...)`).

---

## Template → specialize → instantiate chain

Shipment chain examples:

- `src/test/java/blue/language/samples/paynote/examples/shipment/ShipmentPayNote.java`
- `src/test/java/blue/language/samples/paynote/examples/shipment/DHLShipmentPayNote.java`
- `src/test/java/blue/language/samples/paynote/examples/shipment/AliceBobShipmentPayNote.java`
- `src/test/java/blue/language/samples/paynote/examples/shipment/ShipmentPayNoteChainTest.java`

This demonstrates:

1. Base template (abstract channels + core behavior),
2. Specialization (EUR 200 from CHF + DHL),
3. Final instance bindings (Alice/Bob/guarantor) plus extension.

---

## Voucher flow examples

See:

- `src/test/java/blue/language/samples/paynote/examples/voucher/ArmchairProtectionWithVoucherPayNote.java`
- `src/test/java/blue/language/samples/paynote/examples/voucher/BalancedBowlVoucherPayNote.java`
- `src/test/java/blue/language/samples/paynote/examples/voucher/VoucherFlowExamplesTest.java`

These show:

1. capture locked until satisfaction,
2. funds-captured trigger emits credit-line payment request,
3. monitoring approval flow with budgeted partial captures (`min(spent, remaining)` JS).

---

## JS template safety

Use placeholder-safe templates in JS snippets:

- `steps.jsTemplate("name", "... {{CAPTURE_FUNDS_REQUESTED}} ...")`
- `JsProgram.Builder.linesTemplate(...)` for line-based programs

Unknown placeholders fail fast during authoring (`Unknown JS template token: ...`), preventing silent runtime string drift.

---

## Cookbook examples (24 scenarios)

See:

- `src/test/java/blue/language/samples/paynote/examples/paynote/PayNoteCookbookExamples.java`
- `src/test/java/blue/language/samples/paynote/examples/paynote/PayNoteCookbookExamplesTest.java`

These include:

- shipment escrow variants,
- marketplace split,
- milestone contractors,
- subscriptions and BNPL,
- factoring/FX/insurance flows,
- voucher + credit-line + ACH + crypto + internal-ledger payment request examples.

---

## Cookbook V2 (25 ticket implementation)

See:

- `src/test/java/blue/language/samples/paynote/examples/paynote/PayNoteCookbookExamplesV2.java`
- `src/test/java/blue/language/samples/paynote/examples/paynote/PayNoteCookbookExamplesV2Test.java`
- `docs/paynote-usecase-tracker.md`

Structure:

- Tier 1: 10 tiny patterns
- Tier 2: 10 medium patterns
- Tier 3: 5 JS-heavy patterns

---

## Extension parity (creation-style `extend`)

`DocTemplates.extend(existing, ext -> ...)` now supports creation-style methods directly:

- `participant(...)`, `participants(...)`, `participantsUnion(...)`
- `operation(..., steps -> ...)`
- `onEvent(...)`, `onInit(...)`, `onDocChange(...)`
- `set(...)`

This allows extending existing templates using the same fluent authoring shape as creation.

---

## Operation invocation shape

```yaml
message:
  type: Conversation/Operation Request
  operation: increment
  request: 5
  document:
    blueId: ...
```
