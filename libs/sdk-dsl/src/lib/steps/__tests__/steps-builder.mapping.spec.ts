import { describe, expect, it } from 'vitest';
import { dump } from 'js-yaml';
import { MyOsPermissions } from '../myos-permissions.js';
import { StepsBuilder } from '../steps-builder.js';

describe('steps-builder mapping', () => {
  it('maps payment, capture, and myos step helpers to deterministic structure', () => {
    const steps = new StepsBuilder()
      .triggerPayment('Pay', 'PayNote/Reserve Funds Requested', (payload) =>
        payload
          .processor('stripe')
          .from('payer')
          .to('payee')
          .currency('USD')
          .amountMinorExpression("document('/amount/total')")
          .viaAch()
          .put('routingNumber', '111000025')
          .done(),
      )
      .requestBackwardPayment((payload) =>
        payload
          .processor('voucher')
          .from('merchant')
          .to('customer')
          .reason('refund'),
      )
      .capture()
      .lock()
      .capture()
      .requestNow()
      .myOs('myOsAdminChannel')
      .requestSingleDocPermission(
        'ownerChannel',
        'REQ_1',
        'target-session',
        MyOsPermissions.create().read(true).singleOps('increment'),
      )
      .build();

    const yaml = dump({ steps }, { noRefs: true, lineWidth: -1 });
    expect(yaml).toBe(`steps:
  - name: Pay
    type: Conversation/Trigger Event
    event:
      type: PayNote/Reserve Funds Requested
      processor: stripe
      from: payer
      to: payee
      currency: USD
      amountMinor: \${document('/amount/total')}
      routingNumber: '111000025'
  - name: RequestBackwardPayment
    type: Conversation/Trigger Event
    event:
      type: PayNote/Backward Payment Requested
      processor: voucher
      from: merchant
      to: customer
      reason: refund
  - name: RequestCaptureLock
    type: Conversation/Trigger Event
    event:
      type: PayNote/Card Transaction Capture Lock Requested
  - name: RequestCapture
    type: Conversation/Trigger Event
    event:
      type: PayNote/Capture Funds Requested
      amount: \${document('/amount/total')}
  - name: RequestSingleDocumentPermission
    type: Conversation/Trigger Event
    event:
      type: MyOS/Single Document Permission Grant Requested
      onBehalfOf: ownerChannel
      targetSessionId: target-session
      requestId: REQ_1
      permissions:
        read: true
        singleOps:
          - increment
`);
  });

  it('maps bootstrap document and expression-based helpers', () => {
    const steps = new StepsBuilder()
      .updateDocumentFromExpression(
        'ApplyDynamicChanges',
        'event.message.request',
      )
      .bootstrapDocument(
        'BootstrapChild',
        {
          name: 'Child Document',
          type: 'Conversation/Conversation',
        },
        {
          ownerChannel: 'target-session',
        },
        (payload) => payload.put('bootstrapAssignee', 'myOsAdminChannel'),
      )
      .bootstrapDocumentExpr(
        'BootstrapFromExpression',
        "document('/childDocument')",
        {
          ownerChannel: 'target-session',
        },
      )
      .build();

    const yaml = dump({ steps }, { noRefs: true, lineWidth: -1 });
    expect(yaml).toContain(`name: ApplyDynamicChanges
    type: Conversation/Update Document`);
    expect(yaml).toContain(`changeset: \${event.message.request}`);
    expect(yaml).toContain(`name: BootstrapChild
    type: Conversation/Trigger Event`);
    expect(yaml).toContain(`type: Conversation/Document Bootstrap Requested`);
    expect(yaml).toContain(`bootstrapAssignee: myOsAdminChannel`);
    expect(yaml).toContain(`name: BootstrapFromExpression
    type: Conversation/Trigger Event`);
    expect(yaml).toContain(`document: \${document('/childDocument')}`);
  });

  it('maps raw extension hook steps', () => {
    const steps = new StepsBuilder()
      .raw({
        name: 'CustomRawStep',
        type: 'Conversation/Trigger Event',
        event: {
          type: 'Conversation/Event',
          name: 'raw-event',
          payload: {
            source: 'raw-step',
          },
        },
      })
      .build();

    const yaml = dump({ steps }, { noRefs: true, lineWidth: -1 });
    expect(yaml).toContain(`name: CustomRawStep`);
    expect(yaml).toContain(`type: Conversation/Trigger Event`);
    expect(yaml).toContain(`name: raw-event`);
    expect(yaml).toContain(`source: raw-step`);
  });

  it('maps capture helper variants for lock-state and release flows', () => {
    const steps = new StepsBuilder()
      .capture()
      .markLocked()
      .capture()
      .markUnlocked()
      .capture()
      .requestPartial('event.message.request.amount')
      .capture()
      .releaseFull()
      .build();

    const yaml = dump({ steps }, { noRefs: true, lineWidth: -1 });
    expect(yaml).toContain(`name: CaptureLocked`);
    expect(yaml).toContain(`type: PayNote/Card Transaction Capture Locked`);
    expect(yaml).toContain(`name: CaptureUnlocked`);
    expect(yaml).toContain(`type: PayNote/Card Transaction Capture Unlocked`);
    expect(yaml).toContain(`amount: \${event.message.request.amount}`);
    expect(yaml).toContain(`type: PayNote/Reservation Release Requested`);
  });

  it('maps all payment rail helpers and payload validation guards', () => {
    const steps = new StepsBuilder()
      .triggerPayment(
        'PayAcrossRails',
        'PayNote/Reserve Funds Requested',
        (payload) =>
          payload
            .processor('stripe')
            .from('payer')
            .to('payee')
            .currency('USD')
            .amountMinor(12345)
            .viaSepa()
            .put('ibanFrom', 'DE123')
            .put('ibanTo', 'DE456')
            .put('bicTo', 'BICCODE')
            .put('remittanceInformation', 'invoice-1')
            .done()
            .viaWire()
            .put('bankSwift', 'BOFAUS3N')
            .put('bankName', 'Bank Of Test')
            .put('accountNumber', '1234567890')
            .put('beneficiaryName', 'Ada Lovelace')
            .put('beneficiaryAddress', '42 Main St')
            .done()
            .viaCard()
            .put('cardOnFileRef', 'cof_123')
            .put('merchantDescriptor', 'BLUE-LABS')
            .done()
            .viaTokenizedCard()
            .put('networkToken', 'tok_123')
            .put('tokenProvider', 'network')
            .put('cryptogram', 'crypt')
            .done()
            .viaCreditLine()
            .put('creditLineId', 'line_1')
            .put('merchantAccountId', 'merchant_1')
            .put('cardholderAccountId', 'cardholder_1')
            .done()
            .viaLedger()
            .put('ledgerAccountFrom', 'ops')
            .put('ledgerAccountTo', 'settlement')
            .put('memo', 'internal transfer')
            .done()
            .viaCrypto()
            .put('asset', 'USDC')
            .put('chain', 'BASE')
            .put('fromWalletRef', 'wallet_1')
            .put('toAddress', '0xabc')
            .put('txPolicy', 'fast')
            .done()
            .putCustom('idempotencyKey', 'payment-1')
            .putCustomExpression('merchantRef', "document('/merchant/ref')"),
      )
      .build();

    const yaml = dump({ steps }, { noRefs: true, lineWidth: -1 });
    expect(yaml).toContain(`name: PayAcrossRails`);
    expect(yaml).toContain(`type: PayNote/Reserve Funds Requested`);
    expect(yaml).toContain(`ibanFrom: DE123`);
    expect(yaml).toContain(`bankSwift: BOFAUS3N`);
    expect(yaml).toContain(`cardOnFileRef: cof_123`);
    expect(yaml).toContain(`networkToken: tok_123`);
    expect(yaml).toContain(`creditLineId: line_1`);
    expect(yaml).toContain(`ledgerAccountFrom: ops`);
    expect(yaml).toContain(`asset: USDC`);
    expect(yaml).toContain(`idempotencyKey: payment-1`);
    expect(yaml).toContain(`merchantRef: \${document('/merchant/ref')}`);

    expect(() =>
      new StepsBuilder().triggerPayment(
        'PayNote/Reserve Funds Requested',
        (payload) => payload.from('payer').to('payee'),
      ),
    ).toThrow('payment payload requires processor');

    expect(() =>
      new StepsBuilder().triggerPayment(
        'PayNote/Reserve Funds Requested',
        (payload) => payload.processor('stripe').putCustom('processor', 'bad'),
      ),
    ).toThrow('use processor(...) to set processor');
  });
});
