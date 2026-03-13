import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';
import { DocBuilder } from '../doc-builder.js';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
  operationRequestEvent,
  storedDocumentBlueId,
} from '../../../test-harness/runtime.js';
import { toOfficialJson } from '../../core/serialization.js';

function ownerChannelContract() {
  return {
    type: 'Conversation/Timeline Channel',
    timelineId: 'owner-timeline',
  } as const;
}

async function processOperation(
  document: BlueNode,
  operation: string,
  request: unknown = 1,
  timelineId = 'owner-timeline',
) {
  const blue = createTestBlue();
  const processor = createTestDocumentProcessor(blue);
  const initialized = await expectSuccess(
    processor.initializeDocument(document),
    'document initialization failed',
  );
  const processed = await expectSuccess(
    processor.processDocument(
      initialized.document.clone(),
      operationRequestEvent(blue, {
        operation,
        request,
        timelineId,
        allowNewerVersion: false,
        documentBlueId: storedDocumentBlueId(initialized.document),
      }),
    ),
    `operation '${operation}' processing failed`,
  );
  return {
    blue,
    processor,
    initialized,
    processed,
  };
}

describe('doc-builder matcher runtime execution', () => {
  // Each test follows the same runtime proof pattern:
  // 1) build a document using one matcher helper,
  // 2) trigger runtime event(s) through processor,
  // 3) assert the expected state transition happened.
  it('runs onEvent workflow for emitted Conversation/Event', async () => {
    const document = DocBuilder.doc()
      .name('OnEvent Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation('emit', 'ownerChannel', Number, 'emit event', (steps) =>
        steps.emitType('EmitConversationEvent', 'Conversation/Event'),
      )
      .onEvent('handleEvent', 'Conversation/Event', (steps) =>
        steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs onMyOsResponse workflow with requestId correlation', async () => {
    const document = DocBuilder.doc()
      .name('OnMyOsResponse RequestId Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation('emit', 'ownerChannel', Number, 'emit response', (steps) =>
        steps.emitType(
          'EmitPermissionGranted',
          'MyOS/Single Document Permission Granted',
          (payload) => {
            payload.put('inResponseTo', { requestId: 'REQ_RUNTIME' });
          },
        ),
      )
      .onMyOsResponse(
        'handleGranted',
        'MyOS/Single Document Permission Granted',
        'REQ_RUNTIME',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs onMyOsResponse workflow without requestId matcher', async () => {
    const document = DocBuilder.doc()
      .name('OnMyOsResponse Any Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation('emit', 'ownerChannel', Number, 'emit response', (steps) =>
        steps.emitType(
          'EmitPermissionGranted',
          'MyOS/Single Document Permission Granted',
          (payload) => {
            payload.put('requestId', 'REQ_ANY');
          },
        ),
      )
      .onMyOsResponse(
        'handleGranted',
        'MyOS/Single Document Permission Granted',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs onMyOsResponse workflow with explicit matcher correlation', async () => {
    const document = DocBuilder.doc()
      .name('OnMyOsResponse Matcher Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation(
        'emit',
        'ownerChannel',
        Number,
        'emit subscription initiated response',
        (steps) =>
          steps.emitType(
            'EmitSubscriptionInitiated',
            'MyOS/Subscription to Session Initiated',
            (payload) => {
              payload.put('subscriptionId', 'SUB_RUNTIME');
              payload.put('targetSessionId', 'target-session');
              payload.put('epoch', 0);
            },
          ),
      )
      .onMyOsResponse(
        'handleSubscriptionInitiated',
        'MyOS/Subscription to Session Initiated',
        {
          subscriptionId: 'SUB_RUNTIME',
        },
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs onTriggeredWithId workflow for requestId correlation', async () => {
    const document = DocBuilder.doc()
      .name('OnTriggered requestId Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation('emit', 'ownerChannel', Number, 'emit response', (steps) =>
        steps.emitType('EmitResponse', 'Conversation/Response', (payload) => {
          payload.put('requestId', 'REQ_MATCH');
          payload.put('inResponseTo', { requestId: 'REQ_MATCH' });
        }),
      )
      .onTriggeredWithId(
        'handleResponse',
        'Conversation/Response',
        'requestId',
        'REQ_MATCH',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs onTriggeredWithId workflow for subscriptionId correlation', async () => {
    const document = DocBuilder.doc()
      .name('OnTriggered subscriptionId Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation('emit', 'ownerChannel', Number, 'emit update', (steps) =>
        steps.emitType(
          'EmitSubscriptionUpdate',
          'MyOS/Subscription Update',
          (payload) => {
            payload.put('subscriptionId', 'SUB_MATCH');
          },
        ),
      )
      .onTriggeredWithId(
        'handleUpdate',
        'MyOS/Subscription Update',
        'subscriptionId',
        'SUB_MATCH',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs onTriggeredWithMatcher workflow for custom matcher object', async () => {
    const document = DocBuilder.doc()
      .name('OnTriggered matcher Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation('emit', 'ownerChannel', Number, 'emit event', (steps) =>
        steps.emitType('EmitTopic', 'Conversation/Event', (payload) =>
          payload.put('topic', 'runtime-match'),
        ),
      )
      .onTriggeredWithMatcher(
        'handleTopic',
        'Conversation/Event',
        { topic: 'runtime-match' },
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs typed onSubscriptionUpdate matcher workflow', async () => {
    const document = DocBuilder.doc()
      .name('OnSubscriptionUpdate typed Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation('emit', 'ownerChannel', Number, 'emit update', (steps) =>
        steps.emitType('EmitUpdate', 'MyOS/Subscription Update', (payload) => {
          payload.put('subscriptionId', 'SUB_TYPED');
          payload.put('update', { type: 'Conversation/Response' });
        }),
      )
      .onSubscriptionUpdate(
        'handleUpdate',
        'SUB_TYPED',
        'Conversation/Response',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs untyped onSubscriptionUpdate matcher workflow', async () => {
    const document = DocBuilder.doc()
      .name('OnSubscriptionUpdate untyped Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .operation('emit', 'ownerChannel', Number, 'emit update', (steps) =>
        steps.emitType('EmitUpdate', 'MyOS/Subscription Update', (payload) => {
          payload.put('subscriptionId', 'SUB_ANY');
          payload.put('update', { type: 'Conversation/Event' });
        }),
      )
      .onSubscriptionUpdate('handleUpdate', 'SUB_ANY', (steps) =>
        steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'emit');
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs onDocChange workflow after document path update', async () => {
    const document = DocBuilder.doc()
      .name('OnDocChange Runtime')
      .field('/counter', 0)
      .field('/mirroredCounter', 0)
      .channel('ownerChannel', ownerChannelContract())
      .operation('increment', 'ownerChannel', Number, 'increment', (steps) =>
        steps.replaceExpression(
          'IncrementCounter',
          '/counter',
          "document('/counter') + event.message.request",
        ),
      )
      .onDocChange('mirrorCounter', '/counter', (steps) =>
        steps.replaceExpression(
          'MirrorCounter',
          '/mirroredCounter',
          'event.after',
        ),
      )
      .buildDocument();

    const { processed } = await processOperation(document, 'increment', 3);
    expect(toOfficialJson(processed.document).counter).toBe(3);
    expect(toOfficialJson(processed.document).mirroredCounter).toBe(3);
  });

  it('runs onChannelEvent workflow for timeline message types', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('OnChannelEvent Runtime')
      .field('/handled', false)
      .channel('ownerChannel', ownerChannelContract())
      .onChannelEvent(
        'handleChannelEvent',
        'ownerChannel',
        'Conversation/Chat Message',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'channel event document initialization failed',
    );
    const event = blue.jsonValueToNode({
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: 'owner-timeline',
      },
      message: {
        type: 'Conversation/Chat Message',
        message: 'runtime',
      },
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'channel event processing failed',
    );
    expect(toOfficialJson(processed.document).handled).toBe(true);
  });

  it('runs generated canEmit operation and re-emits request payload events', async () => {
    const document = DocBuilder.doc()
      .name('CanEmit Runtime')
      .channel('myOsAdminChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'myos-admin-timeline',
      })
      .canEmit('myOsAdminChannel')
      .buildDocument();

    const { processed } = await processOperation(
      document,
      'myOsAdminUpdate',
      [
        {
          type: 'Conversation/Event',
          topic: 'runtime-can-emit',
        },
      ],
      'myos-admin-timeline',
    );

    const triggeredEvents = processed.triggeredEvents.map((event) =>
      toOfficialJson(event),
    );
    expect(triggeredEvents).toEqual([
      {
        type: 'Conversation/Event',
        topic: 'runtime-can-emit',
      },
    ]);
  });
});
