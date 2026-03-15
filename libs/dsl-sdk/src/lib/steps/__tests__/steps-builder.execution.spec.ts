import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../../doc-builder/doc-builder.js';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
  operationRequestEvent,
  storedDocumentBlueId,
} from '../../../test-harness/runtime.js';
import { toOfficialJson } from '../../core/serialization.js';

describe('steps-builder execution', () => {
  it('emits trigger events from operation steps during processing', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step Events Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitEvents',
        'ownerChannel',
        Number,
        'Emit helper events',
        (steps) =>
          steps
            .emitType(
              'EmitConversationEvent',
              'Conversation/Event',
              (payload) => payload.put('topic', 'hello'),
            )
            .namedEvent('EmitNamedEvent', 'status', (payload) =>
              payload.put('state', 'ok'),
            ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'Step events document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitEvents',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'Step events operation failed',
    );

    const triggeredEvents = processed.triggeredEvents.map((triggeredEvent) =>
      toOfficialJson(triggeredEvent),
    );
    expect(triggeredEvents).toMatchObject([
      {
        type: 'Conversation/Event',
        topic: 'hello',
      },
      {
        type: 'Common/Named Event',
        name: 'status',
        state: 'ok',
      },
    ]);
  });

  it('emits bootstrap document requests from helper steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step Bootstrap Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'bootstrapChild',
        'ownerChannel',
        Number,
        'Emit bootstrap request',
        (steps) =>
          steps.bootstrapDocument(
            'Bootstrap',
            {
              name: 'Child Runtime',
              summary: 'child bootstrap payload',
            },
            {
              ownerChannel: {
                type: 'Conversation/Timeline Channel',
                timelineId: 'child-owner-timeline',
              },
            },
            'ownerChannel',
            (payload) => payload.put('bootstrapAssignee', 'myOsAdminChannel'),
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step bootstrap document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'bootstrapChild',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step bootstrap operation failed',
    );

    const bootstrapEvent = processed.triggeredEvents
      .map((triggeredEvent) => toOfficialJson(triggeredEvent))
      .find(
        (triggeredEvent) =>
          triggeredEvent.type === 'Conversation/Document Bootstrap Requested',
      );
    expect(bootstrapEvent).toBeDefined();
    expect(bootstrapEvent).toMatchObject({
      channelBindings: {
        ownerChannel: {
          type: 'Conversation/Timeline Channel',
          timelineId: 'child-owner-timeline',
        },
      },
      bootstrapAssignee: 'myOsAdminChannel',
      onBehalfOf: 'ownerChannel',
      document: {
        name: 'Child Runtime',
        summary: 'child bootstrap payload',
      },
    });
  });

  it('emits MyOS bootstrap requests with bootstrapAssignee and explicit onBehalfOf', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step MyOS Bootstrap Runtime')
      .channel('sellerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'seller-timeline',
      })
      .operation(
        'bootstrapDeal',
        'sellerChannel',
        Number,
        'Emit MyOS bootstrap request',
        (steps) =>
          steps.myOs('myOsAdminChannel').bootstrapDocument(
            'BootstrapDeal',
            {
              name: 'Child Deal',
            },
            {
              sellerChannel: {
                type: 'MyOS/MyOS Timeline Channel',
                accountId: 'acc-child-seller',
              },
            },
            'sellerChannel',
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step MyOS bootstrap document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'bootstrapDeal',
      request: 1,
      timelineId: 'seller-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step MyOS bootstrap operation failed',
    );

    const bootstrapEvent = processed.triggeredEvents
      .map((triggeredEvent) => toOfficialJson(triggeredEvent))
      .find(
        (triggeredEvent) =>
          triggeredEvent.type === 'Conversation/Document Bootstrap Requested',
      );
    expect(bootstrapEvent).toBeDefined();
    expect(bootstrapEvent).toMatchObject({
      bootstrapAssignee: 'myOsAdminChannel',
      onBehalfOf: 'sellerChannel',
      channelBindings: {
        sellerChannel: {
          type: 'MyOS/MyOS Timeline Channel',
          accountId: 'acc-child-seller',
        },
      },
      document: {
        name: 'Child Deal',
      },
    });
  });

  it('emits MyOS helper events from operation steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step MyOS Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitMyOsEvents',
        'ownerChannel',
        Number,
        'Emit MyOS helper events',
        (steps) =>
          steps
            .myOs()
            .addParticipant('ownerChannel', 'user@example.com')
            .myOs()
            .removeParticipant('ownerChannel')
            .myOs()
            .callOperation('ownerChannel', 'target-session', 'syncState', {
              type: 'Conversation/Event',
            })
            .myOs()
            .subscribeToSession(
              'target-session',
              'SUB_MYOS',
              'Conversation/Response',
            ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step myos document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitMyOsEvents',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step myos operation failed',
    );

    const triggeredEvents = processed.triggeredEvents.map((triggeredEvent) =>
      toOfficialJson(triggeredEvent),
    );
    const eventTypes = triggeredEvents.map(
      (triggeredEvent) => triggeredEvent.type,
    );
    expect(eventTypes).toContain('MyOS/Adding Participant Requested');
    expect(eventTypes).toContain('MyOS/Removing Participant Requested');
    expect(eventTypes).toContain('MyOS/Call Operation Requested');
    expect(eventTypes).toContain('MyOS/Subscribe to Session Requested');

    const callRequest = triggeredEvents.find(
      (triggeredEvent) =>
        triggeredEvent.type === 'MyOS/Call Operation Requested',
    );
    expect(callRequest).toMatchObject({
      operation: 'syncState',
      targetSessionId: 'target-session',
    });

    const addParticipantRequest = triggeredEvents.find(
      (triggeredEvent) =>
        triggeredEvent.type === 'MyOS/Adding Participant Requested',
    );
    expect(addParticipantRequest).toMatchObject({
      channelName: 'ownerChannel',
      participantBinding: {
        email: 'user@example.com',
      },
    });

    const removeParticipantRequest = triggeredEvents.find(
      (triggeredEvent) =>
        triggeredEvent.type === 'MyOS/Removing Participant Requested',
    );
    expect(removeParticipantRequest).toMatchObject({
      channelName: 'ownerChannel',
    });

    const subscriptionRequest = triggeredEvents.find(
      (triggeredEvent) =>
        triggeredEvent.type === 'MyOS/Subscribe to Session Requested',
    );
    expect(subscriptionRequest).toMatchObject({
      targetSessionId: 'target-session',
      subscription: {
        id: 'SUB_MYOS',
        events: [{ type: 'Conversation/Response' }],
      },
    });
    expect(subscriptionRequest).not.toHaveProperty('onBehalfOf');
  });

  it('emits requestId for explicit MyOS call-operation requests', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step MyOS Call RequestId Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitMyOsCall',
        'ownerChannel',
        Number,
        'Emit MyOS call helper with requestId',
        (steps) =>
          steps.myOs().callOperation(
            'ownerChannel',
            'target-session',
            'syncState',
            {
              type: 'Conversation/Event',
            },
            'REQ_MYOS_CALL',
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step myos call requestId initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitMyOsCall',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step myos call requestId operation failed',
    );

    const callRequest = processed.triggeredEvents
      .map((triggeredEvent) => toOfficialJson(triggeredEvent))
      .find(
        (triggeredEvent) =>
          triggeredEvent.type === 'MyOS/Call Operation Requested',
      );
    expect(callRequest).toMatchObject({
      operation: 'syncState',
      targetSessionId: 'target-session',
      requestId: 'REQ_MYOS_CALL',
    });
  });

  it('emits filtered matcher subscriptions through MyOS helper namespace', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step MyOS Filtered Subscription Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitFilteredSubscribe',
        'ownerChannel',
        Number,
        'Emit filtered subscription request',
        (steps) =>
          steps
            .myOs()
            .subscribeToSessionWithMatchers('target-session', 'SUB_FILTERED', [
              {
                type: 'Conversation/Event',
                topic: 'i-want-this-event',
              },
              {
                type: 'Conversation/Request',
              },
            ]),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'filtered subscribe document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitFilteredSubscribe',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'filtered subscribe operation failed',
    );

    const subscribeRequest = processed.triggeredEvents
      .map((triggeredEvent) => toOfficialJson(triggeredEvent))
      .find(
        (triggeredEvent) =>
          triggeredEvent.type === 'MyOS/Subscribe to Session Requested',
      );
    expect(subscribeRequest).toBeDefined();
    expect(subscribeRequest).toMatchObject({
      subscription: {
        id: 'SUB_FILTERED',
        events: [
          {
            type: 'Conversation/Event',
            topic: 'i-want-this-event',
          },
          {
            type: 'Conversation/Request',
          },
        ],
      },
    });
  });

  it('emits events from raw extension hook steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step Raw Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitRawEvent',
        'ownerChannel',
        Number,
        'Emit raw helper event',
        (steps) =>
          steps.raw({
            name: 'CustomRawStep',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'Conversation/Event',
              name: 'raw-event',
              payload: {
                source: 'raw-step',
              },
            },
          }),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step raw document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitRawEvent',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step raw operation failed',
    );

    const rawEvent = processed.triggeredEvents
      .map((triggeredEvent) => toOfficialJson(triggeredEvent))
      .find(
        (triggeredEvent) =>
          triggeredEvent.type === 'Conversation/Event' &&
          triggeredEvent.name === 'raw-event',
      );
    expect(rawEvent).toBeDefined();
    expect(rawEvent).toMatchObject({
      payload: {
        source: 'raw-step',
      },
    });
  });

  it('surfaces runtime type-availability failure for backward payment requests', async () => {
    expect(() =>
      DocBuilder.doc()
        .name('Step Backward Payment Runtime')
        .channel('ownerChannel', {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        })
        .operation(
          'emitBackwardPayment',
          'ownerChannel',
          Number,
          'Emit backward payment event',
          (steps) =>
            steps.requestBackwardPayment((payload) =>
              payload
                .processor('voucher')
                .from('merchant')
                .to('customer')
                .reason('refund-request'),
            ),
        )
        .buildDocument(),
    ).toThrow(
      "steps.requestBackwardPayment(...) requires repository type alias 'PayNote/Backward Payment Requested'",
    );
  });

  it('emits capture lock-state and release events from capture helpers', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step Capture Runtime')
      .field('/amount/total', 2000)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitCaptureHelpers',
        'ownerChannel',
        Number,
        'Emit capture helper events',
        // prettier-ignore
        (steps) =>
          steps
            .capture()
              .markLocked()
            .capture()
              .markUnlocked()
            .capture()
              .requestPartial('event.message.request')
            .capture()
              .releaseFull(),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step capture helper document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitCaptureHelpers',
      request: 450,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step capture helper operation failed',
    );

    const triggeredEvents = processed.triggeredEvents.map((triggeredEvent) =>
      toOfficialJson(triggeredEvent),
    );
    const eventTypes = triggeredEvents.map(
      (triggeredEvent) => triggeredEvent.type,
    );
    expect(eventTypes).toContain('PayNote/Card Transaction Capture Locked');
    expect(eventTypes).toContain('PayNote/Card Transaction Capture Unlocked');
    expect(eventTypes).toContain('PayNote/Capture Funds Requested');
    expect(eventTypes).toContain('PayNote/Reservation Release Requested');

    const partialCapture = triggeredEvents.find(
      (triggeredEvent) =>
        triggeredEvent.type === 'PayNote/Capture Funds Requested' &&
        triggeredEvent.amount === 450,
    );
    expect(partialCapture).toBeDefined();
  });

  it('emits reserve payment requests with custom rail payload fields', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step Payment Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitPaymentEvent',
        'ownerChannel',
        Number,
        'Emit payment request event',
        (steps) =>
          steps.triggerPayment(
            'PayAcrossRails',
            'PayNote/Reserve Funds Requested',
            (payload) =>
              payload
                .processor('stripe')
                .from('payer')
                .to('payee')
                .currency('USD')
                .amountMinor(12345)
                .viaCrypto()
                .put('asset', 'USDC')
                .put('chain', 'BASE')
                .put('fromWalletRef', 'wallet_1')
                .put('toAddress', '0xabc')
                .put('txPolicy', 'fast')
                .done()
                .putCustom('idempotencyKey', 'payment-1'),
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step payment runtime document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitPaymentEvent',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step payment runtime operation failed',
    );

    const paymentEvent = processed.triggeredEvents
      .map((triggeredEvent) => toOfficialJson(triggeredEvent))
      .find(
        (triggeredEvent) =>
          triggeredEvent.type === 'PayNote/Reserve Funds Requested',
      );
    expect(paymentEvent).toBeDefined();
    expect(paymentEvent).toMatchObject({
      processor: 'stripe',
      from: 'payer',
      to: 'payee',
      currency: 'USD',
      amount: 12345,
      asset: 'USDC',
      chain: 'BASE',
      fromWalletRef: 'wallet_1',
      toAddress: '0xabc',
      txPolicy: 'fast',
      idempotencyKey: 'payment-1',
    });
  });
});
