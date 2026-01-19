import type { BenchFixture } from './types.js';

const OWNER_TIMELINE_ID = 'bench-owner-subscription';

export const subscriptionListenerFixture = {
  name: 'subscription-listener-medium',
  document: {
    name: 'Subscription Listener - Bench',
    type: 'MyOS/MyOS Admin Base',
    subscriptionStatus: 'idle',
    currentTargetSessionId: null,
    revocationReason: null,
    revocationTargetSessionId: null,
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      },
      myOsAdminChannel: {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'bench-admin',
      },
      triggeredEventChannel: {
        type: 'Core/Triggered Event Channel',
      },
      subscribeToTarget: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        request: {
          type: 'Text',
          description: 'Target session id',
        },
      },
      subscribeToTargetImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'subscribeToTarget',
        steps: [
          {
            name: 'EmitSubscriptionRequest',
            type: 'Conversation/JavaScript Code',
            code: `const targetSessionId = event.message.request;
if (!targetSessionId) {
  return { events: [] };
}
return {
  events: [
    {
      type: 'MyOS/Subscribe to Session Requested',
      targetSessionId,
      subscription: {
        id: 'revocation-test',
        events: [
          {
            type: 'Conversation/Event',
            message: 'test-event',
          },
        ],
      },
    },
  ],
};`,
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
          subscriptionId: 'revocation-test',
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
          subscriptionId: 'revocation-test',
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
  },
  events: [
    {
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: OWNER_TIMELINE_ID,
      },
      message: {
        type: 'Conversation/Operation Request',
        operation: 'subscribeToTarget',
        request: 'session-123',
      },
      timestamp: 1700000100,
    },
  ],
} satisfies BenchFixture;
