/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderStepsDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/PayNoteBuilderDslParityTest.java
*/

import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as payNoteBlueIds } from '@blue-repository/types/packages/paynote/blue-ids';

import { DocBuilder } from '../lib';

describe('StepsBuilder PayNote helpers', () => {
  it('builds typed PayNote request events with runtime-confirmed payloads', () => {
    const built = DocBuilder.doc()
      .name('PayNote steps parity')
      .onInit('emitPaynoteEvents', (steps) =>
        steps
          .paynote()
          .reserveFundsRequested('ReserveFunds', {
            requestId: 'REQ_RESERVE',
            amount: 1500,
            name: 'Reserve funds',
            description: 'Reserve the total',
          })
          .paynote()
          .captureFundsRequested('CaptureFunds', {
            amount: DocBuilder.expr("document('/amount/total')"),
          })
          .paynote()
          .reserveFundsAndCaptureImmediatelyRequested('ReserveAndCapture', {
            amount: 2500,
          })
          .paynote()
          .reservationReleaseRequested('ReleaseFunds', {
            amount: DocBuilder.expr('event.amount'),
          })
          .paynote()
          .cardTransactionCaptureLockRequested('LockCapture', {
            requestId: 'REQ_LOCK',
            cardTransactionDetails: {
              retrievalReferenceNumber: 'rrn-1',
            },
          })
          .paynote()
          .cardTransactionCaptureUnlockRequested('UnlockCapture', {
            cardTransactionDetails: {
              authorizationCode: 'AUTH-1',
            },
          })
          .paynote()
          .startCardTransactionMonitoringRequested('MonitorCard', {
            requestId: 'REQ_MONITOR',
            requestedAt: 1700000000,
            targetMerchantId: 'merchant-42',
            events: ['captured', 'reversed'],
          })
          .paynote()
          .linkedCardChargeRequested('LinkedCharge', {
            requestId: 'REQ_LINKED',
            amount: 900,
            paymentMandateDocumentId: 'mandate-1',
            paynote: {
              type: 'PayNote/PayNote',
              currency: 'USD',
            },
          })
          .paynote()
          .reverseCardChargeAndCaptureImmediatelyRequested('ReverseImmediate', {
            amount: 500,
            paymentMandateDocumentId: 'mandate-2',
          })
          .paynote()
          .paymentMandateSpendAuthorizationRequested('AuthorizeSpend', {
            requestId: 'REQ_AUTH',
            authorizationId: 'AUTH_1',
            amountMinor: 1200,
            currency: 'USD',
            counterpartyType: 'merchant',
            counterpartyId: 'merchant-42',
            requestingDocumentId: 'doc-1',
            requestingSessionId: 'session-1',
            requestedAt: '2026-01-01T10:00:00Z',
          })
          .paynote()
          .paymentMandateSpendSettled('SettleSpend', {
            authorizationId: 'AUTH_1',
            settlementId: 'SETTLE_1',
            status: 'accepted',
            reservedDeltaMinor: -1200,
            capturedDeltaMinor: 1200,
            holdId: 'hold-1',
            transactionId: 'tx-1',
            settledAt: '2026-01-01T10:01:00Z',
            inResponseTo: {
              requestId: 'REQ_AUTH',
            },
          }),
      )
      .buildDocument();

    const steps =
      built
        .getContracts()
        ?.emitPaynoteEvents?.getProperties()
        ?.steps?.getItems() ?? [];

    expect(steps[0]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Reserve Funds Requested'],
    );
    expect(
      steps[0]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_RESERVE');
    expect(
      String(
        steps[0]?.getProperties()?.event?.getProperties()?.amount?.getValue(),
      ),
    ).toBe('1500');

    expect(steps[1]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Capture Funds Requested'],
    );
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.amount?.getValue(),
    ).toBe("${document('/amount/total')}");

    expect(steps[2]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Reserve Funds and Capture Immediately Requested'],
    );
    expect(steps[3]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Reservation Release Requested'],
    );
    expect(
      steps[3]?.getProperties()?.event?.getProperties()?.amount?.getValue(),
    ).toBe('${event.amount}');

    expect(steps[4]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Card Transaction Capture Lock Requested'],
    );
    expect(
      steps[4]
        ?.getProperties()
        ?.event?.getProperties()
        ?.cardTransactionDetails?.getProperties()
        ?.retrievalReferenceNumber?.getValue(),
    ).toBe('rrn-1');

    expect(steps[5]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Card Transaction Capture Unlock Requested'],
    );
    expect(
      steps[5]
        ?.getProperties()
        ?.event?.getProperties()
        ?.cardTransactionDetails?.getProperties()
        ?.authorizationCode?.getValue(),
    ).toBe('AUTH-1');

    expect(steps[6]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Start Card Transaction Monitoring Requested'],
    );
    expect(
      steps[6]
        ?.getProperties()
        ?.event?.getProperties()
        ?.targetMerchantId?.getValue(),
    ).toBe('merchant-42');
    expect(
      steps[6]
        ?.getProperties()
        ?.event?.getProperties()
        ?.events?.getItems()?.[1]
        ?.getValue(),
    ).toBe('reversed');

    expect(steps[7]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Linked Card Charge Requested'],
    );
    expect(
      steps[7]
        ?.getProperties()
        ?.event?.getProperties()
        ?.paymentMandateDocumentId?.getValue(),
    ).toBe('mandate-1');
    expect(
      steps[7]
        ?.getProperties()
        ?.event?.getProperties()
        ?.paynote?.getType()
        ?.getBlueId(),
    ).toBe(payNoteBlueIds['PayNote/PayNote']);

    expect(steps[8]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds[
        'PayNote/Reverse Card Charge and Capture Immediately Requested'
      ],
    );
    expect(steps[9]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Payment Mandate Spend Authorization Requested'],
    );
    expect(
      steps[9]
        ?.getProperties()
        ?.event?.getProperties()
        ?.authorizationId?.getValue(),
    ).toBe('AUTH_1');
    expect(steps[10]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      payNoteBlueIds['PayNote/Payment Mandate Spend Settled'],
    );
    expect(
      steps[10]
        ?.getProperties()
        ?.event?.getProperties()
        ?.inResponseTo?.getProperties()
        ?.requestId?.getValue(),
    ).toBe('REQ_AUTH');
  });

  it('builds conversation bootstrap and customer-action helpers with canonical payload shapes', () => {
    const built = DocBuilder.doc()
      .name('Conversation steps parity')
      .onInit('emitConversationEvents', (steps) =>
        steps
          .conversation()
          .documentBootstrapRequested(
            'BootstrapChild',
            {
              name: 'Child Doc',
              type: 'PayNote/PayNote',
            },
            {
              reviewer: 'reviewerChannel',
            },
            {
              requestId: 'REQ_BOOT',
              name: 'Bootstrap request',
              description: 'Spawn a child document',
              bootstrapAssignee: 'myOsAdminChannel',
              defaultMessage: 'Review and approve',
              channelMessages: {
                reviewer: 'Please review',
              },
            },
          )
          .conversation()
          .documentBootstrapRequestedExpr(
            'BootstrapExpr',
            "document('/childTemplate')",
            {
              owner: 'ownerChannel',
            },
            {
              bootstrapAssignee: 'myOsAdminChannel',
            },
          )
          .conversation()
          .documentBootstrapResponded('BootstrapResponded', {
            status: 'accepted',
            reason: 'queued',
            inResponseTo: {
              requestId: 'REQ_BOOT',
            },
          })
          .conversation()
          .documentBootstrapCompleted('BootstrapCompleted', {
            documentId: 'child-doc-1',
            inResponseTo: {
              requestId: 'REQ_BOOT',
            },
          })
          .conversation()
          .documentBootstrapFailed('BootstrapFailed', {
            reason: 'invalid payload',
            inResponseTo: {
              requestId: 'REQ_BOOT',
            },
          })
          .conversation()
          .customerActionRequested('RequestCustomerAction', {
            requestId: 'REQ_ACTION',
            title: 'Accept delivery',
            message: 'Choose how to proceed.',
            actions: [
              {
                label: 'Accept',
                variant: 'primary',
              },
              {
                label: 'Reject',
                inputRequired: true,
                inputTitle: 'Reason',
                inputPlaceholder: 'Explain the rejection',
              },
            ],
          })
          .conversation()
          .customerActionResponded('RespondCustomerAction', {
            actionLabel: 'Reject',
            input: {
              reason: 'Package damaged',
            },
            respondedAt: '2026-01-01T11:00:00Z',
            inResponseTo: {
              requestId: 'REQ_ACTION',
            },
          }),
      )
      .buildDocument();

    const steps =
      built
        .getContracts()
        ?.emitConversationEvents?.getProperties()
        ?.steps?.getItems() ?? [];

    expect(steps[0]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Document Bootstrap Requested'],
    );
    expect(
      steps[0]?.getProperties()?.event?.getProperties()?.requestId?.getValue(),
    ).toBe('REQ_BOOT');
    expect(
      steps[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.bootstrapAssignee?.getValue(),
    ).toBe('myOsAdminChannel');
    expect(
      steps[0]
        ?.getProperties()
        ?.event?.getProperties()
        ?.initialMessages?.getProperties()
        ?.perChannel?.getProperties()
        ?.reviewer?.getValue(),
    ).toBe('Please review');

    expect(steps[1]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Document Bootstrap Requested'],
    );
    expect(
      steps[1]?.getProperties()?.event?.getProperties()?.document?.getValue(),
    ).toBe("${document('/childTemplate')}");

    expect(steps[2]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Document Bootstrap Responded'],
    );
    expect(
      steps[2]?.getProperties()?.event?.getProperties()?.status?.getValue(),
    ).toBe('accepted');

    expect(steps[3]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Document Bootstrap Completed'],
    );
    expect(
      steps[3]?.getProperties()?.event?.getProperties()?.documentId?.getValue(),
    ).toBe('child-doc-1');

    expect(steps[4]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Document Bootstrap Failed'],
    );
    expect(
      steps[4]?.getProperties()?.event?.getProperties()?.reason?.getValue(),
    ).toBe('invalid payload');

    expect(steps[5]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Customer Action Requested'],
    );
    expect(
      steps[5]?.getProperties()?.event?.getProperties()?.title?.getValue(),
    ).toBe('Accept delivery');
    expect(
      steps[5]
        ?.getProperties()
        ?.event?.getProperties()
        ?.actions?.getItems()?.[1]
        ?.getProperties()
        ?.inputRequired?.getValue(),
    ).toBe(true);

    expect(steps[6]?.getProperties()?.event?.getType()?.getBlueId()).toBe(
      conversationBlueIds['Conversation/Customer Action Responded'],
    );
    expect(
      steps[6]
        ?.getProperties()
        ?.event?.getProperties()
        ?.actionLabel?.getValue(),
    ).toBe('Reject');
    expect(
      steps[6]
        ?.getProperties()
        ?.event?.getProperties()
        ?.input?.getProperties()
        ?.reason?.getValue(),
    ).toBe('Package damaged');
  });
});
