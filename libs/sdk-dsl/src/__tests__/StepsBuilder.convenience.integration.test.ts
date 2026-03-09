import { blueIds as payNoteBlueIds } from '@blue-repository/types/packages/paynote/blue-ids';

import { DocBuilder } from '../lib';
import { initializeDocument } from './processor-harness';

describe('StepsBuilder payment convenience runtime', () => {
  it('emits runtime-triggered payment events from init workflows', async () => {
    const built = DocBuilder.doc()
      .name('Payment convenience runtime')
      .onInit('bootstrap', (steps) =>
        steps.triggerPayment(
          'RequestPayment',
          'PayNote/Linked Card Charge Requested',
          (payload) =>
            payload
              .processor('processorChannel')
              .currency('USD')
              .amountMinor(1500)
              .payer({
                channel: 'payerChannel',
              })
              .payee({
                channel: 'payeeChannel',
              })
              .viaCreditLine()
              .creditLineId('facility-1')
              .merchantAccountId('merchant-1')
              .done(),
        ),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const paymentEvent = initialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        payNoteBlueIds['PayNote/Linked Card Charge Requested'],
    );

    expect(paymentEvent).toBeDefined();
    expect(paymentEvent?.getProperties()?.processor?.getValue()).toBe(
      'processorChannel',
    );
    expect(paymentEvent?.getProperties()?.currency?.getValue()).toBe('USD');
    expect(String(paymentEvent?.getProperties()?.amountMinor?.getValue())).toBe(
      '1500',
    );
    expect(
      paymentEvent
        ?.getProperties()
        ?.payer?.getProperties()
        ?.channel?.getValue(),
    ).toBe('payerChannel');
    expect(
      paymentEvent
        ?.getProperties()
        ?.payee?.getProperties()
        ?.channel?.getValue(),
    ).toBe('payeeChannel');
    expect(paymentEvent?.getProperties()?.creditLineId?.getValue()).toBe(
      'facility-1',
    );
    expect(paymentEvent?.getProperties()?.merchantAccountId?.getValue()).toBe(
      'merchant-1',
    );
  });
});
