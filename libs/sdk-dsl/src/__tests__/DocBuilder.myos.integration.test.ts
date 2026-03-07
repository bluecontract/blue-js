/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderGeneralDslParityTest.java
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderInteractionsDslParityTest.java
*/

import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as myOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';

import { DocBuilder } from '../lib';
import {
  getStoredDocumentBlueId,
  initializeDocument,
  processOperationRequest,
} from './processor-harness';

const ADMIN_TIMELINE_ID = 'myos-admin-timeline';
const OWNER_TIMELINE_ID = 'owner-timeline';
const REMOTE_TIMELINE_ID = 'remote-counter-session';

describe('DocBuilder MyOS integration', () => {
  it('re-emits admin-delivered events through myOsAdminUpdate', async () => {
    const built = DocBuilder.doc()
      .name('Admin re-emit integration')
      .field('/status', 'idle')
      .myOsAdmin()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .onEvent(
        'onGranted',
        'MyOS/Single Document Permission Granted',
        (steps) => steps.replaceValue('SetStatus', '/status', 'granted'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Single Document Permission Granted',
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(processed.document.get('/status'))).toBe('granted');
    expect(
      processed.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          myOsBlueIds['MyOS/Single Document Permission Granted'],
      ),
    ).toBe(true);
  });

  it('filters subscription updates by subscriptionId', async () => {
    const built = DocBuilder.doc()
      .name('Subscription update integration')
      .field('/status', 'idle')
      .myOsAdmin()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .onSubscriptionUpdate(
        'onSubscription',
        'SUB_MATCH',
        'MyOS/Session Epoch Advanced',
        (steps) => steps.replaceValue('MarkMatched', '/status', 'matched'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const wrongSubscription = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_OTHER',
          update: {
            type: 'MyOS/Session Epoch Advanced',
            epoch: 1,
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(wrongSubscription.document.get('/status'))).toBe('idle');

    const matched = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: wrongSubscription.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_MATCH',
          update: {
            type: 'MyOS/Session Epoch Advanced',
            epoch: 2,
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(matched.document.get('/status'))).toBe('matched');
  });

  it('triggers MyOS response handlers only for the intended response wrapper shape', async () => {
    const built = DocBuilder.doc()
      .name('MyOS response integration')
      .field('/status', 'idle')
      .myOsAdmin()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .onMyOsResponse(
        'onResponse',
        'MyOS/Call Operation Responded',
        'REQ_MATCH',
        (steps) => steps.replaceValue('SetStatus', '/status', 'responded'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const wrongShape = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'Conversation/Response',
          inResponseTo: {
            requestId: 'REQ_MATCH',
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(wrongShape.document.get('/status'))).toBe('idle');

    const wrongRequestId = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: wrongShape.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Call Operation Responded',
          inResponseTo: {
            requestId: 'REQ_OTHER',
          },
          events: [],
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(wrongRequestId.document.get('/status'))).toBe('idle');

    const matched = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: wrongRequestId.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Call Operation Responded',
          inResponseTo: {
            requestId: 'REQ_MATCH',
          },
          events: [
            {
              type: 'Conversation/Response',
              status: 'ok',
            },
          ],
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(matched.document.get('/status'))).toBe('responded');
  });

  it('lets non-admin documents participate in admin/session-interaction flows', async () => {
    const built = DocBuilder.doc()
      .name('Non-admin session interaction')
      .type('Custom/Type')
      .field('/remoteSessionId', REMOTE_TIMELINE_ID)
      .field('/status', 'idle')
      .myOsAdmin()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .onInit('bootstrap', (steps) =>
        steps
          .myOs()
          .callOperationRequested(
            'ownerChannel',
            DocBuilder.expr("document('/remoteSessionId')"),
            'increment',
            2,
            {
              requestId: 'REQ_BOOTSTRAP',
            },
          ),
      )
      .onMyOsResponse(
        'onResponse',
        'MyOS/Call Operation Responded',
        'REQ_BOOTSTRAP',
        (steps) => steps.replaceValue('SetStatus', '/status', 'completed'),
      )
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);
    const callRequest = initialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Call Operation Requested'],
    );

    expect(initialized.document.getType()?.getValue()).toBe('Custom/Type');
    expect(callRequest).toBeDefined();
    expect(callRequest?.getProperties()?.targetSessionId?.getValue()).toBe(
      REMOTE_TIMELINE_ID,
    );

    const responded = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Call Operation Responded',
          inResponseTo: {
            requestId: 'REQ_BOOTSTRAP',
          },
          events: [],
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(responded.document.get('/status'))).toBe('completed');
  });

  it('supports a small end-to-end counter session-interaction slice with admin response forwarding', async () => {
    const remoteCounter = DocBuilder.doc()
      .name('Remote Counter')
      .field('/counter', 0)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: REMOTE_TIMELINE_ID,
      })
      .operation('increment')
      .channel('ownerChannel')
      .description('Increment the remote counter')
      .requestType('Integer')
      .steps((steps) =>
        steps
          .replaceExpression(
            'ApplyIncrement',
            '/counter',
            "document('/counter') + event.message.request",
          )
          .emitType('EmitResponse', 'Conversation/Response', (payload) =>
            payload.put('status', 'ok'),
          ),
      )
      .done()
      .buildDocument();

    const remoteInitialized = await initializeDocument(remoteCounter);
    const remoteBlueId = getStoredDocumentBlueId(remoteInitialized.document);

    const caller = DocBuilder.doc()
      .name('Counter caller')
      .field('/targetSessionId', REMOTE_TIMELINE_ID)
      .field('/status', 'idle')
      .myOsAdmin()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .onInit('requestRemoteIncrement', (steps) =>
        steps
          .myOs()
          .callOperationRequested(
            'ownerChannel',
            DocBuilder.expr("document('/targetSessionId')"),
            'increment',
            5,
            {
              requestId: 'REQ_COUNTER',
            },
          ),
      )
      .onMyOsResponse(
        'onRemoteIncremented',
        'MyOS/Call Operation Responded',
        'REQ_COUNTER',
        (steps) => steps.replaceValue('MarkCompleted', '/status', 'completed'),
      )
      .buildDocument();

    const callerInitialized = await initializeDocument(caller);
    const callerBlueId = getStoredDocumentBlueId(callerInitialized.document);

    const callRequest = callerInitialized.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Call Operation Requested'],
    );
    expect(callRequest).toBeDefined();
    expect(String(callRequest?.getProperties()?.request?.getValue())).toBe('5');

    const remoteProcessed = await processOperationRequest({
      blue: remoteInitialized.blue,
      processor: remoteInitialized.processor,
      document: remoteInitialized.document,
      timelineId: REMOTE_TIMELINE_ID,
      operation: 'increment',
      request: callRequest?.getProperties()?.request?.getValue(),
      allowNewerVersion: false,
      documentBlueId: remoteBlueId,
    });

    expect(remoteProcessed.document.getAsInteger('/counter')).toBe(5);
    expect(
      remoteProcessed.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
          conversationBlueIds['Conversation/Response'],
      ),
    ).toBe(true);

    const callerCompleted = await processOperationRequest({
      blue: callerInitialized.blue,
      processor: callerInitialized.processor,
      document: callerInitialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Call Operation Responded',
          inResponseTo: {
            requestId: 'REQ_COUNTER',
          },
          events: [
            {
              type: 'Conversation/Response',
              status: 'ok',
            },
          ],
        },
      ],
      allowNewerVersion: false,
      documentBlueId: callerBlueId,
    });

    expect(String(callerCompleted.document.get('/status'))).toBe('completed');
  });
});
