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
});
