/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/PayNoteBuilderDslParityTest.java
- references/java-sdk/src/test/java/blue/language/samples/paynote/PayNoteCookbookExamples.java
*/

import { blueIds as payNoteBlueIds } from '@blue-repository/types/packages/paynote/blue-ids';

import { PayNotes } from '../lib';
import { resolveTypeInput } from '../lib/internal/type-input';
import { assertCanonicalDocMatchesDsl } from './canonical-scenario-support';

describe('PayNotes parity', () => {
  it('builds a base paynote document with runtime-confirmed fields and no duplicated inherited contracts', () => {
    const built = PayNotes.payNote('Basic PayNote')
      .description('Simple paynote')
      .currency('USD')
      .amountMinor(1500)
      .status('pending')
      .buildDocument();

    assertCanonicalDocMatchesDsl(
      {
        name: 'Basic PayNote',
        description: 'Simple paynote',
        type: 'PayNote/PayNote',
        currency: 'USD',
        amount: {
          total: 1500,
        },
        status: 'pending',
      },
      built,
    );

    expect(built.getContracts()?.payerChannel).toBeUndefined();
    expect(built.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/PayNote'],
    );
  });

  it('converts amountMajor using the current currency scale', () => {
    const usd = PayNotes.payNote('USD major amount')
      .currency('USD')
      .amountMajor('12.34')
      .buildDocument();
    const jpy = PayNotes.payNote('JPY major amount')
      .currency('JPY')
      .amountMajor('500')
      .buildDocument();

    expect(usd.getAsInteger('/amount/total')).toBe(1234);
    expect(jpy.getAsInteger('/amount/total')).toBe(500);
  });

  it('requires currency before amountMajor and rejects scale mismatches and negative values', () => {
    expect(() =>
      PayNotes.payNote('Missing currency').amountMajor('10.00'),
    ).toThrow('call currency() before amountMajor()');
    expect(() =>
      PayNotes.payNote('Scale mismatch').currency('USD').amountMajor('10.001'),
    ).toThrow(/exact USD currency scale/);
    expect(() =>
      PayNotes.payNote('Negative amount').currency('USD').amountMinor(-1),
    ).toThrow('amount cannot be negative');
  });

  it('builds card transaction and merchant-to-customer paynotes', () => {
    const card = PayNotes.cardTransactionPayNote('Card PayNote')
      .currency('EUR')
      .amountMinor(4999)
      .cardTransactionDetails({
        retrievalReferenceNumber: 'rrn-1',
        authorizationCode: 'AUTH-1',
      })
      .buildDocument();
    const merchant = PayNotes.merchantToCustomerPayNote('Merchant PayNote')
      .currency('USD')
      .amountMinor(700)
      .buildDocument();

    assertCanonicalDocMatchesDsl(
      {
        name: 'Card PayNote',
        type: 'PayNote/Card Transaction PayNote',
        currency: 'EUR',
        amount: {
          total: 4999,
        },
        cardTransactionDetails: {
          retrievalReferenceNumber: 'rrn-1',
          authorizationCode: 'AUTH-1',
        },
      },
      card,
    );

    assertCanonicalDocMatchesDsl(
      {
        name: 'Merchant PayNote',
        type: 'PayNote/Merchant To Customer PayNote',
        currency: 'USD',
        amount: {
          total: 700,
        },
      },
      merchant,
    );
  });

  it('builds paynote delivery and payment mandate documents with typed fields', () => {
    const delivery = PayNotes.payNoteDelivery('Voucher Delivery')
      .cardTransactionDetails({
        retrievalReferenceNumber: 'rrn-1',
      })
      .payNoteBootstrapRequest({
        type: 'Conversation/Document Bootstrap Requested',
        requestId: 'REQ_PAYNOTE',
        document: {
          name: 'Child PayNote',
          type: 'PayNote/PayNote',
        },
        channelBindings: {
          payerChannel: 'payNoteSender',
          payeeChannel: 'payNoteDeliverer',
        },
      })
      .paymentMandateBootstrapRequest({
        type: 'Conversation/Document Bootstrap Requested',
        requestId: 'REQ_MANDATE',
        document: {
          name: 'Child Mandate',
          type: 'PayNote/Payment Mandate',
        },
        channelBindings: {
          granterChannel: 'payNoteSender',
          granteeChannel: 'payNoteDeliverer',
        },
      })
      .deliveryStatus('pending')
      .transactionIdentificationStatus('identified')
      .clientDecisionStatus('awaiting-decision')
      .clientAcceptedAt('2026-01-01T10:00:00Z')
      .deliveryError('none')
      .buildDocument();

    const mandate = PayNotes.paymentMandate('Seller Mandate')
      .granterType('merchant')
      .granterId('merchant-42')
      .granteeType('customer')
      .granteeId('customer-7')
      .amountLimit(100000)
      .currency('USD')
      .sourceAccount('acct-1')
      .amountReserved(0)
      .amountCaptured(0)
      .allowLinkedPayNote(true)
      .allowedPayNotes([
        {
          documentBlueId: 'paynote-1',
        },
      ])
      .allowedPaymentCounterparties([
        {
          counterpartyType: 'merchant',
          counterpartyId: 'merchant-42',
        },
      ])
      .expiresAt('2026-12-31T23:59:59Z')
      .chargeAttempts({
        AUTH_1: {
          authorizationStatus: 'approved',
          authorizedAmountMinor: 1000,
        },
      })
      .buildDocument();

    assertCanonicalDocMatchesDsl(
      {
        name: 'Voucher Delivery',
        type: 'PayNote/PayNote Delivery',
        cardTransactionDetails: {
          retrievalReferenceNumber: 'rrn-1',
        },
        payNoteBootstrapRequest: {
          type: 'Conversation/Document Bootstrap Requested',
          requestId: 'REQ_PAYNOTE',
          document: {
            name: 'Child PayNote',
            type: 'PayNote/PayNote',
          },
          channelBindings: {
            payerChannel: 'payNoteSender',
            payeeChannel: 'payNoteDeliverer',
          },
        },
        paymentMandateBootstrapRequest: {
          type: 'Conversation/Document Bootstrap Requested',
          requestId: 'REQ_MANDATE',
          document: {
            name: 'Child Mandate',
            type: 'PayNote/Payment Mandate',
          },
          channelBindings: {
            granterChannel: 'payNoteSender',
            granteeChannel: 'payNoteDeliverer',
          },
        },
        deliveryStatus: 'pending',
        transactionIdentificationStatus: 'identified',
        clientDecisionStatus: 'awaiting-decision',
        clientAcceptedAt: '2026-01-01T10:00:00Z',
        deliveryError: 'none',
      },
      delivery,
    );

    assertCanonicalDocMatchesDsl(
      {
        name: 'Seller Mandate',
        type: 'PayNote/Payment Mandate',
        granterType: 'merchant',
        granterId: 'merchant-42',
        granteeType: 'customer',
        granteeId: 'customer-7',
        amountLimit: 100000,
        currency: 'USD',
        sourceAccount: 'acct-1',
        amountReserved: 0,
        amountCaptured: 0,
        allowLinkedPayNote: true,
        allowedPayNotes: [
          {
            documentBlueId: 'paynote-1',
          },
        ],
        allowedPaymentCounterparties: [
          {
            counterpartyType: 'merchant',
            counterpartyId: 'merchant-42',
          },
        ],
        expiresAt: '2026-12-31T23:59:59Z',
        chargeAttempts: {
          AUTH_1: {
            authorizationStatus: 'approved',
            authorizedAmountMinor: 1000,
          },
        },
      },
      mandate,
    );
  });

  it('materializes capture macros with deterministic workflows and operations', () => {
    const built = PayNotes.payNote('Capture action parity')
      .currency('USD')
      .amountMinor(10000)
      .capture()
      .lockOnInit()
      .unlockOnEvent('PayNote/Funds Captured')
      .unlockOnDocPathChange('/capture/open')
      .unlockOnOperation(
        'unlockCaptureByOperation',
        'payerChannel',
        'Unlock capture with extra step.',
        (steps) =>
          steps.replaceValue(
            'MarkCaptureUnlocked',
            '/capture/openedByOp',
            true,
          ),
      )
      .unlockOnOperation(
        'unlockCaptureBySimpleOperation',
        'payerChannel',
        'Unlock capture directly.',
      )
      .requestOnInit()
      .requestOnEvent('PayNote/Funds Captured')
      .requestOnDocPathChange('/capture/open')
      .requestOnOperation(
        'requestCaptureByOperation',
        'guarantorChannel',
        'Request capture by operation.',
      )
      .requestPartialOnOperation(
        'requestCapturePartialByOperation',
        'guarantorChannel',
        'Request partial capture by operation.',
        'event.message.request',
      )
      .requestPartialOnEvent('PayNote/Funds Captured', 'event.amountCaptured')
      .done()
      .buildDocument();

    const contracts = built.getContracts();
    expect(contracts?.captureLockOnInit).toBeDefined();
    expect(contracts?.captureUnlockOnFundsCaptured).toBeDefined();
    expect(contracts?.captureUnlockOnDoccaptureopen).toBeDefined();
    expect(contracts?.unlockCaptureByOperation).toBeDefined();
    expect(contracts?.unlockCaptureByOperationImpl).toBeDefined();
    expect(contracts?.unlockCaptureBySimpleOperationImpl).toBeDefined();
    expect(contracts?.captureRequestOnInit).toBeDefined();
    expect(contracts?.captureRequestOnFundsCaptured).toBeDefined();
    expect(contracts?.captureRequestOnDoccaptureopen).toBeDefined();
    expect(contracts?.requestCaptureByOperationImpl).toBeDefined();
    expect(contracts?.requestCapturePartialByOperationImpl).toBeDefined();
    expect(contracts?.capturePartialOnFundsCaptured).toBeDefined();

    expect(
      built
        .getAsNode('/contracts/captureLockOnInit/steps/0/event')
        ?.getType()
        ?.getBlueId(),
    ).toBe(payNoteBlueIds['PayNote/Card Transaction Capture Lock Requested']);
    expect(
      built
        .getAsNode('/contracts/captureUnlockOnFundsCaptured/steps/0/event')
        ?.getType()
        ?.getBlueId(),
    ).toBe(payNoteBlueIds['PayNote/Card Transaction Capture Unlock Requested']);
    expect(
      built
        .getAsNode(
          '/contracts/unlockCaptureBySimpleOperationImpl/steps/0/event',
        )
        ?.getType()
        ?.getBlueId(),
    ).toBe(payNoteBlueIds['PayNote/Card Transaction Capture Unlock Requested']);
    expect(
      built
        .getAsNode('/contracts/requestCaptureByOperationImpl/steps/0/event')
        ?.getType()
        ?.getBlueId(),
    ).toBe(payNoteBlueIds['PayNote/Capture Funds Requested']);
    expect(
      built
        .getAsNode('/contracts/requestCaptureByOperationImpl/steps/0/event')
        ?.getProperties()
        ?.amount?.getValue(),
    ).toBe("${document('/amount/total')}");
    expect(built.get('/contracts/unlockCaptureByOperation/request')).toBe(
      undefined,
    );
    expect(built.get('/contracts/requestCaptureByOperation/request')).toBe(
      undefined,
    );
    expect(
      built.get('/contracts/requestCapturePartialByOperation/request'),
    ).toBe(undefined);
    expect(
      built
        .getAsNode(
          '/contracts/requestCapturePartialByOperationImpl/steps/0/event',
        )
        ?.getProperties()
        ?.amount?.getValue(),
    ).toBe('${event.message.request}');
    expect(
      built
        .getAsNode('/contracts/capturePartialOnFundsCaptured/steps/0/event')
        ?.getProperties()
        ?.amount?.getValue(),
    ).toBe('${event.amountCaptured}');
  });

  it('materializes reserve and release request macros in the runtime-confirmed subset', () => {
    const built = PayNotes.payNote('Reserve + release request parity')
      .currency('USD')
      .amountMinor(10000)
      .reserve()
      .requestOnInit()
      .requestOnEvent('PayNote/Funds Reserved')
      .requestOnDocPathChange('/reserve/open')
      .requestOnOperation(
        'requestReserve',
        'guarantorChannel',
        'Request reserve',
      )
      .requestPartialOnOperation(
        'requestReservePartial',
        'guarantorChannel',
        'Request partial reserve',
        'event.message.request',
      )
      .requestPartialOnEvent('PayNote/Funds Reserved', 'event.amountReserved')
      .done()
      .release()
      .requestOnInit()
      .requestOnEvent('PayNote/Funds Captured')
      .requestOnDocPathChange('/release/open')
      .requestOnOperation('requestRelease', 'payerChannel', 'Request release')
      .requestPartialOnOperation(
        'requestReleasePartial',
        'payerChannel',
        'Request partial release',
        'event.message.request',
      )
      .requestPartialOnEvent('PayNote/Funds Captured', 'event.amountCaptured')
      .done()
      .buildDocument();

    const contracts = built.getContracts();
    expect(contracts?.reserveRequestOnInit).toBeDefined();
    expect(contracts?.reserveRequestOnFundsReserved).toBeDefined();
    expect(contracts?.reserveRequestOnDocreserveopen).toBeDefined();
    expect(contracts?.requestReserveImpl).toBeDefined();
    expect(contracts?.requestReservePartialImpl).toBeDefined();
    expect(contracts?.reservePartialOnFundsReserved).toBeDefined();
    expect(contracts?.releaseRequestOnInit).toBeDefined();
    expect(contracts?.releaseRequestOnFundsCaptured).toBeDefined();
    expect(contracts?.releaseRequestOnDocreleaseopen).toBeDefined();
    expect(contracts?.requestReleaseImpl).toBeDefined();
    expect(contracts?.requestReleasePartialImpl).toBeDefined();
    expect(contracts?.releasePartialOnFundsCaptured).toBeDefined();

    expect(
      built
        .getAsNode('/contracts/requestReserveImpl/steps/0/event')
        ?.getType()
        ?.getBlueId(),
    ).toBe(payNoteBlueIds['PayNote/Reserve Funds Requested']);
    expect(
      built
        .getAsNode('/contracts/requestReleaseImpl/steps/0/event')
        ?.getType()
        ?.getBlueId(),
    ).toBe(payNoteBlueIds['PayNote/Reservation Release Requested']);
    expect(
      built
        .getAsNode('/contracts/requestReleasePartialImpl/steps/0/event')
        ?.getProperties()
        ?.amount?.getValue(),
    ).toBe('${event.message.request}');
    expect(built.get('/contracts/requestReserve/request')).toBe(undefined);
    expect(built.get('/contracts/requestReservePartial/request')).toBe(
      undefined,
    );
    expect(built.get('/contracts/requestRelease/request')).toBe(undefined);
  });

  it('supports explicit timeline-channel listeners for event-driven PayNote macros', () => {
    const built = PayNotes.payNote('Explicit channel event parity')
      .currency('USD')
      .amountMinor(10000)
      .channel('shipmentChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'shipment-timeline',
      })
      .capture()
      .unlockOnEvent('shipmentChannel', 'Conversation/Chat Message')
      .requestOnEvent('shipmentChannel', 'Conversation/Chat Message')
      .requestPartialOnEvent(
        'shipmentChannel',
        'Conversation/Chat Message',
        'event.message.amount',
      )
      .done()
      .buildDocument();

    expect(
      built
        .getAsNode('/contracts/captureUnlockOnChatMessage/event/message')
        ?.getType()
        ?.getBlueId(),
    ).toBe(resolveTypeInput('Conversation/Chat Message').getBlueId());
    expect(
      built
        .getAsNode('/contracts/captureRequestOnChatMessage/event/message')
        ?.getType()
        ?.getBlueId(),
    ).toBe(resolveTypeInput('Conversation/Chat Message').getBlueId());
    expect(
      built
        .getAsNode('/contracts/capturePartialOnChatMessage/event/message')
        ?.getType()
        ?.getBlueId(),
    ).toBe(resolveTypeInput('Conversation/Chat Message').getBlueId());
    expect(
      built
        .getAsNode('/contracts/capturePartialOnChatMessage/steps/0/event')
        ?.getProperties()
        ?.amount?.getValue(),
    ).toBe('${event.message.amount}');
  });

  it('requires an unlock path for capture lockOnInit and documents unsupported reserve/release lock helpers', () => {
    expect(() =>
      PayNotes.payNote('Capture lock only')
        .currency('USD')
        .amountMinor(100)
        .capture()
        .lockOnInit()
        .done()
        .buildDocument(),
    ).toThrow('capture locked on init but no unlock path configured');

    expect(() =>
      PayNotes.payNote('Reserve lock unsupported')
        .currency('USD')
        .amountMinor(100)
        .reserve()
        .lockOnInit(),
    ).toThrow(/reserve\(\)\.lockOnInit\(\) is not supported/);

    expect(() =>
      PayNotes.payNote('Release unlock unsupported')
        .currency('USD')
        .amountMinor(100)
        .release()
        .unlockOnEvent('PayNote/Funds Captured'),
    ).toThrow(/release\(\)\.unlockOnEvent\(\) is not supported/);
  });

  it('returns configured builders from the PayNotes factory', () => {
    const built = PayNotes.payNote('Factory parity')
      .currency('USD')
      .amountMinor(1)
      .buildDocument();

    expect(built).toBeDefined();
    expect(built.getName()).toBe('Factory parity');
  });
});
