import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as payNoteBlueIds } from '@blue-repository/types/packages/paynote/blue-ids';

import { PayNotes } from '../lib';
import { assertCanonicalDocMatchesDsl } from './canonical-scenario-support';
import {
  createBlue,
  getStoredDocumentBlueId,
  initializeDocument,
  processOperationRequest,
} from './processor-harness';

const DELIVERY_ADMIN_TIMELINE_ID = 'stage6-delivery-admin';
const DELIVERY_OPERATOR_TIMELINE_ID = 'stage6-delivery-operator';
const MANDATE_GRANTEE_TIMELINE_ID = 'stage6-mandate-grantee';

describe('Canonical PayNote business flows', () => {
  it('reconstructs the canonical bootstrap delivery scenario and emits a bootstrap request at runtime', async () => {
    const blue = createBlue();
    const payNoteDocument = PayNotes.cardTransactionPayNote('Issued PayNote')
      .currency('USD')
      .amountMinor(120000)
      .cardTransactionDetails({
        retrievalReferenceNumber: 'rrn-1',
      })
      .buildDocument();

    const payNoteBootstrapRequest = blue.jsonValueToNode({
      type: 'Conversation/Document Bootstrap Requested',
      requestId: 'REQ_PAYNOTE_BOOTSTRAP',
      document: {
        name: 'Issued PayNote',
        type: 'PayNote/Card Transaction PayNote',
        currency: 'USD',
        amount: {
          total: 120000,
        },
        cardTransactionDetails: {
          retrievalReferenceNumber: 'rrn-1',
        },
      },
      channelBindings: {
        payerChannel: 'payNoteSender',
        payeeChannel: 'payNoteDeliverer',
      },
    });
    const paymentMandateBootstrapRequest = blue.jsonValueToNode({
      type: 'Conversation/Document Bootstrap Requested',
      requestId: 'REQ_MANDATE_BOOTSTRAP',
      document: {
        name: 'Seller Mandate',
        type: 'PayNote/Payment Mandate',
        granterType: 'merchant',
        granterId: 'merchant-42',
        granteeType: 'customer',
        granteeId: 'customer-7',
        amountLimit: 120000,
        currency: 'USD',
      },
      channelBindings: {
        granterChannel: 'payNoteSender',
        granteeChannel: 'payNoteDeliverer',
        guarantorChannel: 'payNoteDeliverer',
      },
    });

    const fromDsl = PayNotes.payNoteDelivery('Bootstrap delivery')
      .cardTransactionDetails({
        retrievalReferenceNumber: 'rrn-1',
      })
      .payNoteBootstrapRequest(payNoteBootstrapRequest)
      .paymentMandateBootstrapRequest(paymentMandateBootstrapRequest)
      .channel('myOsAdminChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: DELIVERY_ADMIN_TIMELINE_ID,
      })
      .onInit('bootstrapPayNoteChild', (steps) =>
        steps.conversation().documentBootstrapRequested(
          'BootstrapPayNote',
          payNoteDocument,
          {
            payerChannel: 'payNoteSender',
            payeeChannel: 'payNoteDeliverer',
          },
          {
            requestId: 'REQ_PAYNOTE_BOOTSTRAP',
            bootstrapAssignee: 'myOsAdminChannel',
            defaultMessage: 'Please review the issued paynote.',
          },
        ),
      )
      .buildDocument();

    assertCanonicalDocMatchesDsl(
      {
        name: 'Bootstrap delivery',
        type: 'PayNote/PayNote Delivery',
        cardTransactionDetails: {
          retrievalReferenceNumber: 'rrn-1',
        },
        payNoteBootstrapRequest: {
          type: 'Conversation/Document Bootstrap Requested',
          requestId: 'REQ_PAYNOTE_BOOTSTRAP',
          document: {
            name: 'Issued PayNote',
            type: 'PayNote/Card Transaction PayNote',
            currency: 'USD',
            amount: {
              total: 120000,
            },
            cardTransactionDetails: {
              retrievalReferenceNumber: 'rrn-1',
            },
          },
          channelBindings: {
            payerChannel: 'payNoteSender',
            payeeChannel: 'payNoteDeliverer',
          },
        },
        paymentMandateBootstrapRequest: {
          type: 'Conversation/Document Bootstrap Requested',
          requestId: 'REQ_MANDATE_BOOTSTRAP',
          document: {
            name: 'Seller Mandate',
            type: 'PayNote/Payment Mandate',
            granterType: 'merchant',
            granterId: 'merchant-42',
            granteeType: 'customer',
            granteeId: 'customer-7',
            amountLimit: 120000,
            currency: 'USD',
          },
          channelBindings: {
            granterChannel: 'payNoteSender',
            granteeChannel: 'payNoteDeliverer',
            guarantorChannel: 'payNoteDeliverer',
          },
        },
        contracts: {
          myOsAdminChannel: {
            type: 'MyOS/MyOS Timeline Channel',
            timelineId: DELIVERY_ADMIN_TIMELINE_ID,
          },
          initLifecycleChannel: {
            type: 'Core/Lifecycle Event Channel',
            event: {
              type: 'Core/Document Processing Initiated',
            },
          },
          bootstrapPayNoteChild: {
            type: 'Conversation/Sequential Workflow',
            channel: 'initLifecycleChannel',
            steps: [
              {
                name: 'BootstrapPayNote',
                type: 'Conversation/Trigger Event',
                event: {
                  type: 'Conversation/Document Bootstrap Requested',
                  requestId: 'REQ_PAYNOTE_BOOTSTRAP',
                  bootstrapAssignee: 'myOsAdminChannel',
                  document: {
                    name: 'Issued PayNote',
                    type: 'PayNote/Card Transaction PayNote',
                    currency: 'USD',
                    amount: {
                      total: 120000,
                    },
                    cardTransactionDetails: {
                      retrievalReferenceNumber: 'rrn-1',
                    },
                  },
                  channelBindings: {
                    payerChannel: 'payNoteSender',
                    payeeChannel: 'payNoteDeliverer',
                  },
                  initialMessages: {
                    defaultMessage: 'Please review the issued paynote.',
                  },
                },
              },
            ],
          },
        },
      },
      fromDsl,
    );

    const initialized = await initializeDocument(fromDsl);
    const bootstrapEvent = initialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
          conversationBlueIds['Conversation/Document Bootstrap Requested'] &&
        event.getProperties()?.requestId?.getValue() ===
          'REQ_PAYNOTE_BOOTSTRAP',
    );

    expect(bootstrapEvent).toBeDefined();
    expect(
      bootstrapEvent?.getProperties()?.document?.getType()?.getBlueId(),
    ).toBe(payNoteBlueIds['PayNote/Card Transaction PayNote']);
  });

  it('reconstructs the canonical customer-action delivery flow and proves request/response behavior', async () => {
    const fromDsl = PayNotes.payNoteDelivery('Delivery customer action')
      .clientDecisionStatus('pending')
      .channel('myOsAdminChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: DELIVERY_ADMIN_TIMELINE_ID,
      })
      .myOsAdmin()
      .channel('payNoteDeliverer', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: DELIVERY_OPERATOR_TIMELINE_ID,
      })
      .operation('requestDeliveryDecision')
      .channel('payNoteDeliverer')
      .description('Request a customer delivery decision')
      .requestType('Boolean')
      .steps((steps) =>
        steps.conversation().customerActionRequested('RequestDecision', {
          requestId: 'REQ_DELIVERY_ACTION',
          title: 'Accept the delivered paynote?',
          message: 'Choose whether to accept or reject the delivery.',
          actions: [
            {
              label: 'accept',
              variant: 'primary',
            },
            {
              label: 'reject',
              inputRequired: true,
              inputTitle: 'Reason',
              inputPlaceholder: 'Explain the rejection',
            },
          ],
        }),
      )
      .done()
      .onEvent(
        'applyCustomerDecision',
        'Conversation/Customer Action Responded',
        (steps) =>
          steps
            .replaceExpression(
              'SaveDecision',
              '/clientDecisionStatus',
              'event.actionLabel',
            )
            .replaceExpression(
              'SaveResponseAt',
              '/clientRespondedAt',
              'event.respondedAt',
            ),
      )
      .buildDocument();

    assertCanonicalDocMatchesDsl(
      {
        name: 'Delivery customer action',
        type: 'PayNote/PayNote Delivery',
        clientDecisionStatus: 'pending',
        contracts: {
          myOsAdminChannel: {
            type: 'MyOS/MyOS Timeline Channel',
            timelineId: DELIVERY_ADMIN_TIMELINE_ID,
          },
          myOsAdminUpdate: {
            type: 'Conversation/Operation',
            description:
              'The standard, required operation for MyOS Admin to deliver events.',
            channel: 'myOsAdminChannel',
            request: {
              type: 'List',
            },
          },
          myOsAdminUpdateImpl: {
            type: 'Conversation/Sequential Workflow Operation',
            description: 'Implementation that re-emits the provided events',
            operation: 'myOsAdminUpdate',
            steps: [
              {
                name: 'EmitAdminEvents',
                type: 'Conversation/JavaScript Code',
                code: 'return { events: event.message.request };',
              },
            ],
          },
          payNoteDeliverer: {
            type: 'MyOS/MyOS Timeline Channel',
            timelineId: DELIVERY_OPERATOR_TIMELINE_ID,
          },
          requestDeliveryDecision: {
            type: 'Conversation/Operation',
            channel: 'payNoteDeliverer',
            description: 'Request a customer delivery decision',
            request: {
              type: 'Boolean',
            },
          },
          requestDeliveryDecisionImpl: {
            type: 'Conversation/Sequential Workflow Operation',
            operation: 'requestDeliveryDecision',
            steps: [
              {
                name: 'RequestDecision',
                type: 'Conversation/Trigger Event',
                event: {
                  type: 'Conversation/Customer Action Requested',
                  requestId: 'REQ_DELIVERY_ACTION',
                  title: 'Accept the delivered paynote?',
                  message: 'Choose whether to accept or reject the delivery.',
                  actions: [
                    {
                      label: 'accept',
                      variant: 'primary',
                    },
                    {
                      label: 'reject',
                      inputRequired: true,
                      inputTitle: 'Reason',
                      inputPlaceholder: 'Explain the rejection',
                    },
                  ],
                },
              },
            ],
          },
          triggeredEventChannel: {
            type: 'Core/Triggered Event Channel',
          },
          applyCustomerDecision: {
            type: 'Conversation/Sequential Workflow',
            channel: 'triggeredEventChannel',
            event: {
              type: 'Conversation/Customer Action Responded',
            },
            steps: [
              {
                name: 'SaveDecision',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/clientDecisionStatus',
                    val: '${event.actionLabel}',
                  },
                ],
              },
              {
                name: 'SaveResponseAt',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/clientRespondedAt',
                    val: '${event.respondedAt}',
                  },
                ],
              },
            ],
          },
        },
      },
      fromDsl,
    );

    const initialized = await initializeDocument(fromDsl);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const requested = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: DELIVERY_OPERATOR_TIMELINE_ID,
      operation: 'requestDeliveryDecision',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(
      requested.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
            conversationBlueIds['Conversation/Customer Action Requested'] &&
          event.getProperties()?.requestId?.getValue() ===
            'REQ_DELIVERY_ACTION',
      ),
    ).toBe(true);

    const responded = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: requested.document,
      timelineId: DELIVERY_ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'Conversation/Customer Action Responded',
          actionLabel: 'accept',
          respondedAt: '2026-01-01T11:00:00Z',
          inResponseTo: {
            requestId: 'REQ_DELIVERY_ACTION',
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(responded.document.get('/clientDecisionStatus'))).toBe(
      'accept',
    );
    expect(String(responded.document.get('/clientRespondedAt'))).toBe(
      '2026-01-01T11:00:00Z',
    );
  });

  it('reconstructs the canonical payment-mandate authorization and settlement flow', async () => {
    const fromDsl = PayNotes.paymentMandate('Mandate spend orchestration')
      .granterType('merchant')
      .granterId('merchant-42')
      .granteeType('customer')
      .granteeId('customer-7')
      .amountLimit(100000)
      .currency('USD')
      .amountReserved(2500)
      .amountCaptured(0)
      .chargeAttempts({
        AUTH_1: {
          authorizationStatus: 'approved',
        },
      })
      .channel('myOsAdminChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: DELIVERY_ADMIN_TIMELINE_ID,
      })
      .myOsAdmin()
      .channel('granteeChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: MANDATE_GRANTEE_TIMELINE_ID,
      })
      .operation('authorizeSpend')
      .channel('granteeChannel')
      .description('Request payment-mandate authorization')
      .requestType('Boolean')
      .steps((steps) =>
        steps
          .paynote()
          .paymentMandateSpendAuthorizationRequested('AuthorizeSpend', {
            requestId: 'REQ_AUTH',
            authorizationId: 'AUTH_1',
            amountMinor: 2500,
            currency: 'USD',
            counterpartyType: 'merchant',
            counterpartyId: 'merchant-42',
            requestingDocumentId: 'doc-1',
            requestingSessionId: 'session-1',
            requestedAt: '2026-01-01T12:00:00Z',
          }),
      )
      .done()
      .onEvent(
        'applySettlement',
        'PayNote/Payment Mandate Spend Settled',
        (steps) =>
          steps
            .replaceExpression(
              'UpdateReservedAmount',
              '/amountReserved',
              "document('/amountReserved') + event.reservedDeltaMinor",
            )
            .replaceExpression(
              'UpdateCapturedAmount',
              '/amountCaptured',
              "document('/amountCaptured') + event.capturedDeltaMinor",
            )
            .replaceExpression(
              'SaveSettlementStatus',
              '/chargeAttempts/AUTH_1/lastSettlementProcessingStatus',
              'event.status',
            ),
      )
      .buildDocument();

    assertCanonicalDocMatchesDsl(
      {
        name: 'Mandate spend orchestration',
        type: 'PayNote/Payment Mandate',
        granterType: 'merchant',
        granterId: 'merchant-42',
        granteeType: 'customer',
        granteeId: 'customer-7',
        amountLimit: 100000,
        currency: 'USD',
        amountReserved: 2500,
        amountCaptured: 0,
        chargeAttempts: {
          AUTH_1: {
            authorizationStatus: 'approved',
          },
        },
        contracts: {
          myOsAdminChannel: {
            type: 'MyOS/MyOS Timeline Channel',
            timelineId: DELIVERY_ADMIN_TIMELINE_ID,
          },
          myOsAdminUpdate: {
            type: 'Conversation/Operation',
            description:
              'The standard, required operation for MyOS Admin to deliver events.',
            channel: 'myOsAdminChannel',
            request: {
              type: 'List',
            },
          },
          myOsAdminUpdateImpl: {
            type: 'Conversation/Sequential Workflow Operation',
            description: 'Implementation that re-emits the provided events',
            operation: 'myOsAdminUpdate',
            steps: [
              {
                name: 'EmitAdminEvents',
                type: 'Conversation/JavaScript Code',
                code: 'return { events: event.message.request };',
              },
            ],
          },
          granteeChannel: {
            type: 'MyOS/MyOS Timeline Channel',
            timelineId: MANDATE_GRANTEE_TIMELINE_ID,
          },
          authorizeSpend: {
            type: 'Conversation/Operation',
            channel: 'granteeChannel',
            description: 'Request payment-mandate authorization',
            request: {
              type: 'Boolean',
            },
          },
          authorizeSpendImpl: {
            type: 'Conversation/Sequential Workflow Operation',
            operation: 'authorizeSpend',
            steps: [
              {
                name: 'AuthorizeSpend',
                type: 'Conversation/Trigger Event',
                event: {
                  type: 'PayNote/Payment Mandate Spend Authorization Requested',
                  requestId: 'REQ_AUTH',
                  authorizationId: 'AUTH_1',
                  amountMinor: 2500,
                  currency: 'USD',
                  counterpartyType: 'merchant',
                  counterpartyId: 'merchant-42',
                  requestingDocumentId: 'doc-1',
                  requestingSessionId: 'session-1',
                  requestedAt: '2026-01-01T12:00:00Z',
                },
              },
            ],
          },
          triggeredEventChannel: {
            type: 'Core/Triggered Event Channel',
          },
          applySettlement: {
            type: 'Conversation/Sequential Workflow',
            channel: 'triggeredEventChannel',
            event: {
              type: 'PayNote/Payment Mandate Spend Settled',
            },
            steps: [
              {
                name: 'UpdateReservedAmount',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/amountReserved',
                    val: "${document('/amountReserved') + event.reservedDeltaMinor}",
                  },
                ],
              },
              {
                name: 'UpdateCapturedAmount',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/amountCaptured',
                    val: "${document('/amountCaptured') + event.capturedDeltaMinor}",
                  },
                ],
              },
              {
                name: 'SaveSettlementStatus',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/chargeAttempts/AUTH_1/lastSettlementProcessingStatus',
                    val: '${event.status}',
                  },
                ],
              },
            ],
          },
        },
      },
      fromDsl,
    );

    const initialized = await initializeDocument(fromDsl);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const authorized = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: MANDATE_GRANTEE_TIMELINE_ID,
      operation: 'authorizeSpend',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(
      authorized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
            payNoteBlueIds[
              'PayNote/Payment Mandate Spend Authorization Requested'
            ] &&
          event.getProperties()?.authorizationId?.getValue() === 'AUTH_1',
      ),
    ).toBe(true);

    const settled = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: authorized.document,
      timelineId: DELIVERY_ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'PayNote/Payment Mandate Spend Settled',
          authorizationId: 'AUTH_1',
          settlementId: 'SETTLE_1',
          status: 'accepted',
          reservedDeltaMinor: -2500,
          capturedDeltaMinor: 2500,
          settledAt: '2026-01-01T12:05:00Z',
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(settled.document.get('/amountReserved'))).toBe('0');
    expect(String(settled.document.get('/amountCaptured'))).toBe('2500');
    expect(
      String(
        settled.document.get(
          '/chargeAttempts/AUTH_1/lastSettlementProcessingStatus',
        ),
      ),
    ).toBe('accepted');
  });
});
