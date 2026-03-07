import { DocBuilder } from '../lib';
import {
  initializeDocument,
  makeTimelineEntryEvent,
  processExternalEvent,
  processOperationRequest,
} from './processor-harness';
import {
  assertCanonicalDocMatchesDsl,
  assertCanonicalEventListsMatchDsl,
  assertCanonicalNodeMatchesDsl,
  canonicalDocToNode,
} from './canonical-scenario-support';

const CALL_OPERATION_NAME = 'forwardCallOperation';
const NO_RESPONSES_CALL_OPERATION_NAME = 'noResponsesCallOperation';
const EVENT_PATTERN_SUBSCRIPTION_ID = 'event-pattern';
const REQUEST_PATTERN_SUBSCRIPTION_ID = 'request-pattern';
const REVOCATION_SUBSCRIPTION_ID = 'revocation-test';

const EMIT_CALL_RESPONSES_CODE = `
const originalRequest = event.message.request || {};
const requestId = originalRequest.requestId;

return {
  events: [
    {
      type: 'Conversation/Response',
      name: 'CallAcceptedResponse',
      inResponseTo: {
        requestId,
      },
      summary: 'First response emitted from target operation',
    },
    {
      type: 'Conversation/Request',
      name: 'FakeRequest',
      requestId: requestId,
      summary: 'Fake request emitted from target operation',
    },
    {
      name: 'FakeEvent',
      summary: 'Fake event emitted from target operation',
    },
    {
      type: 'Conversation/Response',
      name: 'CallCompletedResponse',
      inResponseTo: {
        requestId,
      },
      summary: 'Second response emitted from target operation',
    },
  ],
};
          `;

const EMIT_NO_RESPONSES_CODE = `
const originalRequest = event.message.request || {};
const requestId = originalRequest.requestId;

return {
  events: [
    {
      type: 'Conversation/Request',
      name: 'FakeRequest',
      requestId: requestId,
      summary: 'Fake request emitted from target operation',
    },
    {
      name: 'FakeEvent',
      summary: 'Fake event emitted from target operation',
    },
  ],
};
          `;

const EMIT_PATTERN_SUBSCRIPTIONS_CODE = `const payload = event.message.request || {};
    const targetSessionId = payload.targetSessionId;
    if (!targetSessionId) {
      return { events: [] };
    }
    return {
      events: [
        {
          type: 'MyOS/Subscribe to Session Requested',
          targetSessionId,
          subscription: {
            id: '${EVENT_PATTERN_SUBSCRIPTION_ID}',
            events: [
              {
                type: 'Conversation/Event',
                topic: 'i-want-this-event',
              },
            ],
          },
        },
        {
          type: 'MyOS/Subscribe to Session Requested',
          targetSessionId,
          subscription: {
            id: '${REQUEST_PATTERN_SUBSCRIPTION_ID}',
            events: [
              {
                type: 'Conversation/Request',
              },
            ],
          },
        },
      ],
    };`;

const EMIT_REVOCATION_SUBSCRIPTION_CODE = `const payload = event.message.request || {};
    const targetSessionId = payload.targetSessionId;
    if (!targetSessionId) {
      return { events: [] };
    }
    return {
      events: [
        {
          type: 'MyOS/Subscribe to Session Requested',
          targetSessionId,
          subscription: {
            id: '${REVOCATION_SUBSCRIPTION_ID}',
            events: [
              {
                type: 'Conversation/Event',
                topic: 'revocation-test',
              },
            ],
          },
        },
      ],
    };`;

function buildReferenceCallResponseTargetDocument(
  runId: string,
): Record<string, unknown> {
  return {
    name: `Call Response Forwarding Target - ${runId}`,
    type: 'MyOS/MyOS Admin Base',
    lastRequest: null,
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      myOsAdminChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      [CALL_OPERATION_NAME]: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Conversation/Request',
          description: 'Call payload forwarded back to the caller',
        },
      },
      [NO_RESPONSES_CALL_OPERATION_NAME]: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Conversation/Request',
          description: 'Call payload forwarded back to the caller',
        },
      },
      [`${CALL_OPERATION_NAME}Impl`]: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: CALL_OPERATION_NAME,
        steps: [
          {
            name: 'RecordLastRequest',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/lastRequest',
                val: '${event.message.request}',
              },
            ],
          },
          {
            name: 'EmitCallResponses',
            type: 'Conversation/JavaScript Code',
            code: EMIT_CALL_RESPONSES_CODE,
          },
        ],
      },
      [`${NO_RESPONSES_CALL_OPERATION_NAME}Impl`]: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: NO_RESPONSES_CALL_OPERATION_NAME,
        steps: [
          {
            name: 'RecordLastRequest',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/lastRequest',
                val: '${event.message.request}',
              },
            ],
          },
          {
            name: 'EmitCallResponses',
            type: 'Conversation/JavaScript Code',
            code: EMIT_NO_RESPONSES_CODE,
          },
        ],
      },
    },
  };
}

function buildDslCallResponseTargetDocument(runId: string) {
  return DocBuilder.doc()
    .name(`Call Response Forwarding Target - ${runId}`)
    .type('MyOS/MyOS Admin Base')
    .field('/lastRequest', null)
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('myOsAdminChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .operation(CALL_OPERATION_NAME)
    .channel('ownerChannel')
    .request({
      type: 'Conversation/Request',
      description: 'Call payload forwarded back to the caller',
    })
    .steps((steps) =>
      steps
        .replaceExpression(
          'RecordLastRequest',
          '/lastRequest',
          'event.message.request',
        )
        .jsRaw('EmitCallResponses', EMIT_CALL_RESPONSES_CODE),
    )
    .done()
    .operation(NO_RESPONSES_CALL_OPERATION_NAME)
    .channel('ownerChannel')
    .request({
      type: 'Conversation/Request',
      description: 'Call payload forwarded back to the caller',
    })
    .steps((steps) =>
      steps
        .replaceExpression(
          'RecordLastRequest',
          '/lastRequest',
          'event.message.request',
        )
        .jsRaw('EmitCallResponses', EMIT_NO_RESPONSES_CODE),
    )
    .done()
    .buildDocument();
}

function buildReferencePublicEventSourceDocument(
  runId: string,
): Record<string, unknown> {
  return {
    name: `Subscription Event Source - ${runId}`,
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      emitPatternedEvents: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
      },
      emitPatternedEventsImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'emitPatternedEvents',
        steps: [
          {
            name: 'EmitPatternedEvents',
            type: 'Conversation/JavaScript Code',
            code: `return {
      events: [
        {
          type: 'Conversation/Request',
          requestId: "abc",
          topic: 'i-want-this-event',
        },
        {
          type: 'Conversation/Event',
          topic: 'not-this-event',
        },
      ],
    };`,
          },
        ],
      },
    },
  };
}

function buildDslPublicEventSourceDocument(runId: string) {
  return DocBuilder.doc()
    .name(`Subscription Event Source - ${runId}`)
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .operation('emitPatternedEvents')
    .channel('ownerChannel')
    .steps((steps) =>
      steps.jsRaw(
        'EmitPatternedEvents',
        `return {
      events: [
        {
          type: 'Conversation/Request',
          requestId: "abc",
          topic: 'i-want-this-event',
        },
        {
          type: 'Conversation/Event',
          topic: 'not-this-event',
        },
      ],
    };`,
      ),
    )
    .done()
    .buildDocument();
}

function buildReferencePatternSubscriberDocument(
  runId: string,
): Record<string, unknown> {
  return {
    name: `Subscription Pattern Subscriber - ${runId}`,
    type: 'MyOS/MyOS Admin Base',
    eventPatternMatchCount: 0,
    requestPatternMatchCount: 0,
    eventPatternTopic: null,
    requestPatternTopic: null,
    subscriptionsReady: 0,
    targetSessionId: null,
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      myOsAdminChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      triggeredEventChannel: {
        type: 'Core/Triggered Event Channel',
      },
      initializeSubscriptions: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        request: {
          targetSessionId: {
            type: 'Text',
            description: 'Target session id',
          },
        },
      },
      initializeSubscriptionsImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'initializeSubscriptions',
        steps: [
          {
            name: 'EmitSubscriptionRequests',
            type: 'Conversation/JavaScript Code',
            code: EMIT_PATTERN_SUBSCRIPTIONS_CODE,
          },
          {
            name: 'StoreSubscriptionContext',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/targetSessionId',
                val: '${event.message && event.message.request ? event.message.request.targetSessionId : null}',
              },
            ],
          },
        ],
      },
      markSubscriptionReady: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Subscription to Session Initiated',
        },
        steps: [
          {
            name: 'IncrementSubscriptionReadyCount',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/subscriptionsReady',
                val: '${document("/subscriptionsReady") + 1}',
              },
            ],
          },
        ],
      },
      recordEventPatternMatches: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Subscription Update',
          subscriptionId: EVENT_PATTERN_SUBSCRIPTION_ID,
        },
        steps: [
          {
            name: 'UpdateEventPatternCounters',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/eventPatternMatchCount',
                val: '${document("/eventPatternMatchCount") + 1}',
              },
              {
                op: 'replace',
                path: '/eventPatternTopic',
                val: '${event.update && event.update.topic && event.update.topic.value !== undefined ? event.update.topic.value : (event.update ? event.update.topic : null)}',
              },
            ],
          },
        ],
      },
      recordRequestPatternMatches: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Subscription Update',
          subscriptionId: REQUEST_PATTERN_SUBSCRIPTION_ID,
        },
        steps: [
          {
            name: 'UpdateRequestPatternCounters',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/requestPatternMatchCount',
                val: '${document("/requestPatternMatchCount") + 1}',
              },
              {
                op: 'replace',
                path: '/requestPatternTopic',
                val: '${event.update && event.update.topic && event.update.topic.value !== undefined ? event.update.topic.value : (event.update ? event.update.topic : null)}',
              },
            ],
          },
        ],
      },
    },
  };
}

function buildDslPatternSubscriberDocument(runId: string) {
  return DocBuilder.doc()
    .name(`Subscription Pattern Subscriber - ${runId}`)
    .type('MyOS/MyOS Admin Base')
    .field('/eventPatternMatchCount', 0)
    .field('/requestPatternMatchCount', 0)
    .field('/eventPatternTopic', null)
    .field('/requestPatternTopic', null)
    .field('/subscriptionsReady', 0)
    .field('/targetSessionId', null)
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('myOsAdminChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('triggeredEventChannel', { type: 'Core/Triggered Event Channel' })
    .operation('initializeSubscriptions')
    .channel('ownerChannel')
    .request({
      targetSessionId: {
        type: 'Text',
        description: 'Target session id',
      },
    })
    .steps((steps) =>
      steps
        .jsRaw('EmitSubscriptionRequests', EMIT_PATTERN_SUBSCRIPTIONS_CODE)
        .updateDocument('StoreSubscriptionContext', (changeset) =>
          changeset.replaceExpression(
            '/targetSessionId',
            'event.message && event.message.request ? event.message.request.targetSessionId : null',
          ),
        ),
    )
    .done()
    .onEvent(
      'markSubscriptionReady',
      'MyOS/Subscription to Session Initiated',
      (steps) =>
        steps.replaceExpression(
          'IncrementSubscriptionReadyCount',
          '/subscriptionsReady',
          'document("/subscriptionsReady") + 1',
        ),
    )
    .onSubscriptionUpdate(
      'recordEventPatternMatches',
      EVENT_PATTERN_SUBSCRIPTION_ID,
      (steps) =>
        steps.updateDocument('UpdateEventPatternCounters', (changeset) =>
          changeset
            .replaceExpression(
              '/eventPatternMatchCount',
              'document("/eventPatternMatchCount") + 1',
            )
            .replaceExpression(
              '/eventPatternTopic',
              'event.update && event.update.topic && event.update.topic.value !== undefined ? event.update.topic.value : (event.update ? event.update.topic : null)',
            ),
        ),
    )
    .onSubscriptionUpdate(
      'recordRequestPatternMatches',
      REQUEST_PATTERN_SUBSCRIPTION_ID,
      (steps) =>
        steps.updateDocument('UpdateRequestPatternCounters', (changeset) =>
          changeset
            .replaceExpression(
              '/requestPatternMatchCount',
              'document("/requestPatternMatchCount") + 1',
            )
            .replaceExpression(
              '/requestPatternTopic',
              'event.update && event.update.topic && event.update.topic.value !== undefined ? event.update.topic.value : (event.update ? event.update.topic : null)',
            ),
        ),
    )
    .buildDocument();
}

function buildReferenceRevocationEventSourceDocument(
  runId: string,
): Record<string, unknown> {
  return {
    name: `Subscription Revocation Source - ${runId}`,
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      emitEvent: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
      },
      emitEventImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'emitEvent',
        steps: [
          {
            name: 'EmitEvent',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'Conversation/Event',
              topic: 'revocation-test',
            },
          },
        ],
      },
    },
  };
}

function buildDslRevocationEventSourceDocument(runId: string) {
  return DocBuilder.doc()
    .name(`Subscription Revocation Source - ${runId}`)
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .operation('emitEvent')
    .channel('ownerChannel')
    .steps((steps) =>
      steps.emitType('EmitEvent', 'Conversation/Event', (payload) =>
        payload.put('topic', 'revocation-test'),
      ),
    )
    .done()
    .buildDocument();
}

function buildReferenceRevocationSubscriberDocument(
  runId: string,
): Record<string, unknown> {
  return {
    name: `Subscription Revocation Listener - ${runId}`,
    type: 'MyOS/MyOS Admin Base',
    subscriptionStatus: 'idle',
    currentTargetSessionId: null,
    revocationReason: null,
    revocationTargetSessionId: null,
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      myOsAdminChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      triggeredEventChannel: {
        type: 'Core/Triggered Event Channel',
      },
      subscribeToTarget: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        request: {
          targetSessionId: {
            type: 'Text',
            description: 'Target session id',
          },
        },
      },
      subscribeToTargetImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'subscribeToTarget',
        steps: [
          {
            name: 'EmitSubscriptionRequest',
            type: 'Conversation/JavaScript Code',
            code: EMIT_REVOCATION_SUBSCRIPTION_CODE,
          },
          {
            name: 'StoreSubscriptionMetadata',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/currentTargetSessionId',
                val: '${event.message && event.message.request ? event.message.request.targetSessionId : null}',
              },
              {
                op: 'replace',
                path: '/subscriptionStatus',
                val: 'pending',
              },
            ],
          },
        ],
      },
      markSubscriptionActive: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Subscription to Session Initiated',
          subscriptionId: REVOCATION_SUBSCRIPTION_ID,
        },
        steps: [
          {
            name: 'SetSubscriptionActive',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/subscriptionStatus',
                val: 'active',
              },
            ],
          },
        ],
      },
      recordSubscriptionRevoked: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Subscription to Session Revoked',
          subscriptionId: REVOCATION_SUBSCRIPTION_ID,
        },
        steps: [
          {
            name: 'StoreRevocationDetails',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/subscriptionStatus',
                val: 'revoked',
              },
              {
                op: 'replace',
                path: '/revocationReason',
                val: '${event.reason && event.reason.value !== undefined ? event.reason.value : event.reason}',
              },
              {
                op: 'replace',
                path: '/revocationTargetSessionId',
                val: '${event.targetSessionId}',
              },
            ],
          },
        ],
      },
    },
  };
}

function buildDslRevocationSubscriberDocument(runId: string) {
  return DocBuilder.doc()
    .name(`Subscription Revocation Listener - ${runId}`)
    .type('MyOS/MyOS Admin Base')
    .field('/subscriptionStatus', 'idle')
    .field('/currentTargetSessionId', null)
    .field('/revocationReason', null)
    .field('/revocationTargetSessionId', null)
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('myOsAdminChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('triggeredEventChannel', { type: 'Core/Triggered Event Channel' })
    .operation('subscribeToTarget')
    .channel('ownerChannel')
    .request({
      targetSessionId: {
        type: 'Text',
        description: 'Target session id',
      },
    })
    .steps((steps) =>
      steps
        .jsRaw('EmitSubscriptionRequest', EMIT_REVOCATION_SUBSCRIPTION_CODE)
        .updateDocument('StoreSubscriptionMetadata', (changeset) =>
          changeset
            .replaceExpression(
              '/currentTargetSessionId',
              'event.message && event.message.request ? event.message.request.targetSessionId : null',
            )
            .replaceValue('/subscriptionStatus', 'pending'),
        ),
    )
    .done()
    .onTriggeredWithId(
      'markSubscriptionActive',
      'MyOS/Subscription to Session Initiated',
      'subscriptionId',
      REVOCATION_SUBSCRIPTION_ID,
      (steps) =>
        steps.replaceValue(
          'SetSubscriptionActive',
          '/subscriptionStatus',
          'active',
        ),
    )
    .onTriggeredWithId(
      'recordSubscriptionRevoked',
      'MyOS/Subscription to Session Revoked',
      'subscriptionId',
      REVOCATION_SUBSCRIPTION_ID,
      (steps) =>
        steps.updateDocument('StoreRevocationDetails', (changeset) =>
          changeset
            .replaceValue('/subscriptionStatus', 'revoked')
            .replaceExpression(
              '/revocationReason',
              'event.reason && event.reason.value !== undefined ? event.reason.value : event.reason',
            )
            .replaceExpression(
              '/revocationTargetSessionId',
              'event.targetSessionId',
            ),
        ),
    )
    .buildDocument();
}

function buildReferenceSdpgSubscriberDocument(options: {
  readonly runId: string;
  readonly targetSessionId: string;
  readonly subscriptionId: string;
  readonly requestId?: string;
}): Record<string, unknown> {
  return {
    name: `SDPG Subscriber - ${options.runId}`,
    type: 'MyOS/MyOS Admin Base',
    mirroredCounter: 0,
    contracts: {
      ownerChannel: { type: 'MyOS/MyOS Timeline Channel' },
      myOsAdminChannel: { type: 'MyOS/MyOS Timeline Channel' },
      triggeredEventChannel: { type: 'Core/Triggered Event Channel' },
      initLifecycleChannel: {
        type: 'Core/Lifecycle Event Channel',
        event: { type: 'Core/Document Processing Initiated' },
      },
      emitSdpgRequest: {
        type: 'Conversation/Sequential Workflow',
        channel: 'initLifecycleChannel',
        steps: [
          {
            name: 'RequestSingleDocumentPermission',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'MyOS/Single Document Permission Grant Requested',
              onBehalfOf: 'ownerChannel',
              targetSessionId: options.targetSessionId,
              permissions: { read: true, singleOps: ['increment'] },
              ...(options.requestId ? { requestId: options.requestId } : {}),
            },
          },
        ],
      },
      subscribeOnGranted: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: { type: 'MyOS/Single Document Permission Granted' },
        steps: [
          {
            name: 'SubscribeToCounter',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'MyOS/Subscribe to Session Requested',
              targetSessionId: options.targetSessionId,
              subscription: {
                id: options.subscriptionId,
              },
            },
          },
        ],
      },
      requestIncrementOnSubscriptionReady: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Subscription to Session Initiated',
          subscriptionId: options.subscriptionId,
        },
        steps: [
          {
            name: 'RequestIncrementViaAdmin',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'MyOS/Call Operation Requested',
              onBehalfOf: 'ownerChannel',
              targetSessionId: options.targetSessionId,
              operation: 'increment',
              request: 2,
            },
          },
        ],
      },
      mirrorCounterOnUpdate: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Subscription Update',
          subscriptionId: options.subscriptionId,
          update: { type: 'MyOS/Session Epoch Advanced' },
        },
        steps: [
          {
            name: 'UpdateMirroredCounter',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/mirroredCounter',
                val: '${event.update.document.counter}',
              },
            ],
          },
        ],
      },
    },
  };
}

function buildDslSdpgSubscriberDocument(options: {
  readonly runId: string;
  readonly targetSessionId: string;
  readonly subscriptionId: string;
  readonly requestId?: string;
}) {
  return DocBuilder.doc()
    .name(`SDPG Subscriber - ${options.runId}`)
    .type('MyOS/MyOS Admin Base')
    .field('/mirroredCounter', 0)
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('myOsAdminChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('triggeredEventChannel', { type: 'Core/Triggered Event Channel' })
    .channel('initLifecycleChannel', {
      type: 'Core/Lifecycle Event Channel',
      event: { type: 'Core/Document Processing Initiated' },
    })
    .onInit('emitSdpgRequest', (steps) =>
      steps.myOs().singleDocumentPermissionGrantRequested(
        'ownerChannel',
        options.targetSessionId,
        {
          read: true,
          singleOps: ['increment'],
        },
        {
          requestId: options.requestId,
          stepName: 'RequestSingleDocumentPermission',
        },
      ),
    )
    .onEvent(
      'subscribeOnGranted',
      'MyOS/Single Document Permission Granted',
      (steps) =>
        steps
          .myOs()
          .subscribeToSessionRequested(
            options.targetSessionId,
            options.subscriptionId,
            {
              stepName: 'SubscribeToCounter',
            },
          ),
    )
    .onTriggeredWithId(
      'requestIncrementOnSubscriptionReady',
      'MyOS/Subscription to Session Initiated',
      'subscriptionId',
      options.subscriptionId,
      (steps) =>
        steps
          .myOs()
          .callOperationRequested(
            'ownerChannel',
            options.targetSessionId,
            'increment',
            2,
            {
              stepName: 'RequestIncrementViaAdmin',
            },
          ),
    )
    .onSubscriptionUpdate(
      'mirrorCounterOnUpdate',
      options.subscriptionId,
      'MyOS/Session Epoch Advanced',
      (steps) =>
        steps.replaceExpression(
          'UpdateMirroredCounter',
          '/mirroredCounter',
          'event.update.document.counter',
        ),
    )
    .buildDocument();
}

async function initializePair(
  referenceDocument: Record<string, unknown>,
  dslDocument: ReturnType<typeof DocBuilder.doc> extends never ? never : any,
) {
  const reference = await initializeDocument(
    canonicalDocToNode(referenceDocument),
  );
  const dsl = await initializeDocument(dslDocument);
  return {
    reference,
    dsl,
  };
}

describe('Canonical MyOS foundations', () => {
  describe('Admin call/response forwarding', () => {
    it('matches the canonical document structurally', () => {
      const runId = 'suite10-call-target';
      assertCanonicalDocMatchesDsl(
        buildReferenceCallResponseTargetDocument(runId),
        buildDslCallResponseTargetDocument(runId),
      );
    });

    it('matches the canonical runtime for request recording and mixed response emission', async () => {
      const runId = 'suite10-call-target-runtime';
      const { reference, dsl } = await initializePair(
        buildReferenceCallResponseTargetDocument(runId),
        buildDslCallResponseTargetDocument(runId),
      );

      const request = {
        type: 'Conversation/Request',
        requestId: 'REQ_CALL_1',
      };

      const referenceResult = await processOperationRequest({
        blue: reference.blue,
        processor: reference.processor,
        document: reference.document,
        timelineId: 'owner-timeline',
        operation: CALL_OPERATION_NAME,
        request,
      });
      const dslResult = await processOperationRequest({
        blue: dsl.blue,
        processor: dsl.processor,
        document: dsl.document,
        timelineId: 'owner-timeline',
        operation: CALL_OPERATION_NAME,
        request,
      });

      assertCanonicalNodeMatchesDsl(
        referenceResult.document,
        dslResult.document,
      );
      assertCanonicalEventListsMatchDsl(
        referenceResult.triggeredEvents,
        dslResult.triggeredEvents,
      );
    });
  });

  describe('Filtered subscription lifecycle', () => {
    it('matches the public event source and pattern subscriber documents structurally', () => {
      const runId = 'suite10-pattern';
      assertCanonicalDocMatchesDsl(
        buildReferencePublicEventSourceDocument(runId),
        buildDslPublicEventSourceDocument(runId),
      );
      assertCanonicalDocMatchesDsl(
        buildReferencePatternSubscriberDocument(runId),
        buildDslPatternSubscriberDocument(runId),
      );
    });

    it('matches the canonical runtime for filtered subscription setup and updates', async () => {
      const runId = 'suite10-pattern-runtime';
      const source = await initializePair(
        buildReferencePublicEventSourceDocument(runId),
        buildDslPublicEventSourceDocument(runId),
      );
      const subscriber = await initializePair(
        buildReferencePatternSubscriberDocument(runId),
        buildDslPatternSubscriberDocument(runId),
      );

      const referenceSourceEvents = await processOperationRequest({
        blue: source.reference.blue,
        processor: source.reference.processor,
        document: source.reference.document,
        timelineId: 'source-owner',
        operation: 'emitPatternedEvents',
        request: {},
      });
      const dslSourceEvents = await processOperationRequest({
        blue: source.dsl.blue,
        processor: source.dsl.processor,
        document: source.dsl.document,
        timelineId: 'source-owner',
        operation: 'emitPatternedEvents',
        request: {},
      });

      assertCanonicalEventListsMatchDsl(
        referenceSourceEvents.triggeredEvents,
        dslSourceEvents.triggeredEvents,
      );

      const initRequest = {
        targetSessionId: 'session-pattern-1',
      };
      const referenceInit = await processOperationRequest({
        blue: subscriber.reference.blue,
        processor: subscriber.reference.processor,
        document: subscriber.reference.document,
        timelineId: 'subscriber-owner',
        operation: 'initializeSubscriptions',
        request: initRequest,
      });
      const dslInit = await processOperationRequest({
        blue: subscriber.dsl.blue,
        processor: subscriber.dsl.processor,
        document: subscriber.dsl.document,
        timelineId: 'subscriber-owner',
        operation: 'initializeSubscriptions',
        request: initRequest,
      });

      assertCanonicalNodeMatchesDsl(referenceInit.document, dslInit.document);
      assertCanonicalEventListsMatchDsl(
        referenceInit.triggeredEvents,
        dslInit.triggeredEvents,
      );

      const subscriptionReadyMessage = {
        type: 'MyOS/Subscription to Session Initiated',
        subscriptionId: EVENT_PATTERN_SUBSCRIPTION_ID,
      };
      const referenceReady = await processExternalEvent({
        processor: subscriber.reference.processor,
        document: referenceInit.document,
        event: makeTimelineEntryEvent(subscriber.reference.blue, {
          timelineId: 'admin-timeline',
          message: subscriptionReadyMessage,
        }),
      });
      const dslReady = await processExternalEvent({
        processor: subscriber.dsl.processor,
        document: dslInit.document,
        event: makeTimelineEntryEvent(subscriber.dsl.blue, {
          timelineId: 'admin-timeline',
          message: subscriptionReadyMessage,
        }),
      });

      assertCanonicalNodeMatchesDsl(referenceReady.document, dslReady.document);

      const eventPatternUpdate = {
        type: 'MyOS/Subscription Update',
        subscriptionId: EVENT_PATTERN_SUBSCRIPTION_ID,
        update: {
          type: 'Conversation/Event',
          topic: 'i-want-this-event',
        },
      };
      const referenceEventMatch = await processExternalEvent({
        processor: subscriber.reference.processor,
        document: referenceReady.document,
        event: makeTimelineEntryEvent(subscriber.reference.blue, {
          timelineId: 'admin-timeline',
          message: eventPatternUpdate,
        }),
      });
      const dslEventMatch = await processExternalEvent({
        processor: subscriber.dsl.processor,
        document: dslReady.document,
        event: makeTimelineEntryEvent(subscriber.dsl.blue, {
          timelineId: 'admin-timeline',
          message: eventPatternUpdate,
        }),
      });

      assertCanonicalNodeMatchesDsl(
        referenceEventMatch.document,
        dslEventMatch.document,
      );

      const requestPatternUpdate = {
        type: 'MyOS/Subscription Update',
        subscriptionId: REQUEST_PATTERN_SUBSCRIPTION_ID,
        update: {
          type: 'Conversation/Request',
          topic: 'request-match',
        },
      };
      const referenceRequestMatch = await processExternalEvent({
        processor: subscriber.reference.processor,
        document: referenceEventMatch.document,
        event: makeTimelineEntryEvent(subscriber.reference.blue, {
          timelineId: 'admin-timeline',
          message: requestPatternUpdate,
        }),
      });
      const dslRequestMatch = await processExternalEvent({
        processor: subscriber.dsl.processor,
        document: dslEventMatch.document,
        event: makeTimelineEntryEvent(subscriber.dsl.blue, {
          timelineId: 'admin-timeline',
          message: requestPatternUpdate,
        }),
      });

      assertCanonicalNodeMatchesDsl(
        referenceRequestMatch.document,
        dslRequestMatch.document,
      );
    });

    it('matches the revocation source and subscriber documents structurally', () => {
      const runId = 'suite10-revocation';
      assertCanonicalDocMatchesDsl(
        buildReferenceRevocationEventSourceDocument(runId),
        buildDslRevocationEventSourceDocument(runId),
      );
      assertCanonicalDocMatchesDsl(
        buildReferenceRevocationSubscriberDocument(runId),
        buildDslRevocationSubscriberDocument(runId),
      );
    });

    it('matches the canonical runtime for subscription revocation handling', async () => {
      const runId = 'suite10-revocation-runtime';
      const source = await initializePair(
        buildReferenceRevocationEventSourceDocument(runId),
        buildDslRevocationEventSourceDocument(runId),
      );
      const subscriber = await initializePair(
        buildReferenceRevocationSubscriberDocument(runId),
        buildDslRevocationSubscriberDocument(runId),
      );

      const referenceSource = await processOperationRequest({
        blue: source.reference.blue,
        processor: source.reference.processor,
        document: source.reference.document,
        timelineId: 'source-owner',
        operation: 'emitEvent',
        request: {},
      });
      const dslSource = await processOperationRequest({
        blue: source.dsl.blue,
        processor: source.dsl.processor,
        document: source.dsl.document,
        timelineId: 'source-owner',
        operation: 'emitEvent',
        request: {},
      });

      assertCanonicalEventListsMatchDsl(
        referenceSource.triggeredEvents,
        dslSource.triggeredEvents,
      );

      const subscribeRequest = {
        targetSessionId: 'revocation-session-1',
      };
      const referencePending = await processOperationRequest({
        blue: subscriber.reference.blue,
        processor: subscriber.reference.processor,
        document: subscriber.reference.document,
        timelineId: 'subscriber-owner',
        operation: 'subscribeToTarget',
        request: subscribeRequest,
      });
      const dslPending = await processOperationRequest({
        blue: subscriber.dsl.blue,
        processor: subscriber.dsl.processor,
        document: subscriber.dsl.document,
        timelineId: 'subscriber-owner',
        operation: 'subscribeToTarget',
        request: subscribeRequest,
      });

      assertCanonicalNodeMatchesDsl(
        referencePending.document,
        dslPending.document,
      );
      assertCanonicalEventListsMatchDsl(
        referencePending.triggeredEvents,
        dslPending.triggeredEvents,
      );

      const activeMessage = {
        type: 'MyOS/Subscription to Session Initiated',
        subscriptionId: REVOCATION_SUBSCRIPTION_ID,
      };
      const referenceActive = await processExternalEvent({
        processor: subscriber.reference.processor,
        document: referencePending.document,
        event: makeTimelineEntryEvent(subscriber.reference.blue, {
          timelineId: 'admin-timeline',
          message: activeMessage,
        }),
      });
      const dslActive = await processExternalEvent({
        processor: subscriber.dsl.processor,
        document: dslPending.document,
        event: makeTimelineEntryEvent(subscriber.dsl.blue, {
          timelineId: 'admin-timeline',
          message: activeMessage,
        }),
      });

      assertCanonicalNodeMatchesDsl(
        referenceActive.document,
        dslActive.document,
      );

      const revokedMessage = {
        type: 'MyOS/Subscription to Session Revoked',
        subscriptionId: REVOCATION_SUBSCRIPTION_ID,
        reason: 'READ permission missing',
        targetSessionId: 'revocation-session-1',
      };
      const referenceRevoked = await processExternalEvent({
        processor: subscriber.reference.processor,
        document: referenceActive.document,
        event: makeTimelineEntryEvent(subscriber.reference.blue, {
          timelineId: 'admin-timeline',
          message: revokedMessage,
        }),
      });
      const dslRevoked = await processExternalEvent({
        processor: subscriber.dsl.processor,
        document: dslActive.document,
        event: makeTimelineEntryEvent(subscriber.dsl.blue, {
          timelineId: 'admin-timeline',
          message: revokedMessage,
        }),
      });

      assertCanonicalNodeMatchesDsl(
        referenceRevoked.document,
        dslRevoked.document,
      );
    });
  });

  describe('Single-document permission subscriber foundation', () => {
    it('matches the subscriber canonical document structurally', () => {
      const options = {
        runId: 'suite10-sdpg',
        targetSessionId: 'counter-session-1',
        subscriptionId: 'counter-sub-1',
        requestId: 'sdpg-req-1',
      };

      assertCanonicalDocMatchesDsl(
        buildReferenceSdpgSubscriberDocument(options),
        buildDslSdpgSubscriberDocument(options),
      );
    });

    it('matches the canonical runtime for request, subscribe, call, and mirror flows', async () => {
      const options = {
        runId: 'suite10-sdpg-runtime',
        targetSessionId: 'counter-session-1',
        subscriptionId: 'counter-sub-1',
        requestId: 'sdpg-req-1',
      };

      const { reference, dsl } = await initializePair(
        buildReferenceSdpgSubscriberDocument(options),
        buildDslSdpgSubscriberDocument(options),
      );

      assertCanonicalEventListsMatchDsl(
        reference.triggeredEvents,
        dsl.triggeredEvents,
      );

      const grantedMessage = {
        type: 'MyOS/Single Document Permission Granted',
      };
      const referenceGranted = await processExternalEvent({
        processor: reference.processor,
        document: reference.document,
        event: makeTimelineEntryEvent(reference.blue, {
          timelineId: 'admin-timeline',
          message: grantedMessage,
        }),
      });
      const dslGranted = await processExternalEvent({
        processor: dsl.processor,
        document: dsl.document,
        event: makeTimelineEntryEvent(dsl.blue, {
          timelineId: 'admin-timeline',
          message: grantedMessage,
        }),
      });

      assertCanonicalNodeMatchesDsl(
        referenceGranted.document,
        dslGranted.document,
      );
      assertCanonicalEventListsMatchDsl(
        referenceGranted.triggeredEvents,
        dslGranted.triggeredEvents,
      );

      const readyMessage = {
        type: 'MyOS/Subscription to Session Initiated',
        subscriptionId: options.subscriptionId,
      };
      const referenceReady = await processExternalEvent({
        processor: reference.processor,
        document: referenceGranted.document,
        event: makeTimelineEntryEvent(reference.blue, {
          timelineId: 'admin-timeline',
          message: readyMessage,
        }),
      });
      const dslReady = await processExternalEvent({
        processor: dsl.processor,
        document: dslGranted.document,
        event: makeTimelineEntryEvent(dsl.blue, {
          timelineId: 'admin-timeline',
          message: readyMessage,
        }),
      });

      assertCanonicalNodeMatchesDsl(referenceReady.document, dslReady.document);
      assertCanonicalEventListsMatchDsl(
        referenceReady.triggeredEvents,
        dslReady.triggeredEvents,
      );

      const updateMessage = {
        type: 'MyOS/Subscription Update',
        subscriptionId: options.subscriptionId,
        update: {
          type: 'MyOS/Session Epoch Advanced',
          document: {
            counter: 2,
          },
        },
      };
      const referenceUpdated = await processExternalEvent({
        processor: reference.processor,
        document: referenceReady.document,
        event: makeTimelineEntryEvent(reference.blue, {
          timelineId: 'admin-timeline',
          message: updateMessage,
        }),
      });
      const dslUpdated = await processExternalEvent({
        processor: dsl.processor,
        document: dslReady.document,
        event: makeTimelineEntryEvent(dsl.blue, {
          timelineId: 'admin-timeline',
          message: updateMessage,
        }),
      });

      assertCanonicalNodeMatchesDsl(
        referenceUpdated.document,
        dslUpdated.document,
      );
    });
  });
});
