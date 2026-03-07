import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as myOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';

import { DocBuilder } from '../lib';
import { assertCanonicalDocMatchesDsl } from './canonical-scenario-support';
import {
  getStoredDocumentBlueId,
  initializeDocument,
  processOperationRequest,
} from './processor-harness';

const ADMIN_TIMELINE_ID = 'canonical-ai-admin';
const OWNER_TIMELINE_ID = 'canonical-ai-owner';
const PROVIDER_SESSION_ID = 'canonical-ai-provider-session';

describe('Canonical AI provider patterns', () => {
  it('reconstructs the provider request/response correlation scenario with the DSL and proves it in the processor', async () => {
    const fromDsl = DocBuilder.doc()
      .name('Provider request/response correlation')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/providerSessionId', PROVIDER_SESSION_ID)
      .field('/promptTemplate', 'Summarize request')
      .field('/summary/status', 'idle')
      .field('/summary/output', '')
      .ai('planner')
      .sessionId(DocBuilder.expr("document('/providerSessionId')"))
      .permissionFrom('ownerChannel')
      .statusPath('/planner/status')
      .contextPath('/planner/context')
      .requesterId('PLANNER')
      .task('summarize')
      .instruction('Return concise structured JSON.')
      .expects('Conversation/Response')
      .done()
      .done()
      .operation('requestSummary')
      .channel('ownerChannel')
      .requestType('Text')
      .description('Ask provider for a summary')
      .steps((steps) =>
        steps.askAI('planner', 'AskPlanner', (ask) =>
          ask
            .task('summarize')
            .instruction("Prompt: ${document('/promptTemplate')}")
            .instruction('Body: ${event.message.request}'),
        ),
      )
      .done()
      .onAIResponse('planner', 'onSummaryResponse', (steps) =>
        steps
          .replaceExpression(
            'SaveAnswer',
            '/summary/output',
            'event.update.message',
          )
          .replaceValue('MarkComplete', '/summary/status', 'complete'),
      )
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    assertCanonicalDocMatchesDsl(
      {
        name: 'Provider request/response correlation',
        providerSessionId: PROVIDER_SESSION_ID,
        promptTemplate: 'Summarize request',
        summary: {
          status: 'idle',
          output: '',
        },
        planner: {
          status: 'pending',
          context: {},
        },
        contracts: {
          ownerChannel: {
            type: 'Conversation/Timeline Channel',
            timelineId: OWNER_TIMELINE_ID,
          },
          myOsAdminChannel: {
            type: 'MyOS/MyOS Timeline Channel',
            timelineId: ADMIN_TIMELINE_ID,
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
          initLifecycleChannel: {
            type: 'Core/Lifecycle Event Channel',
            event: {
              type: 'Core/Document Processing Initiated',
            },
          },
          triggeredEventChannel: {
            type: 'Core/Triggered Event Channel',
          },
          aiPLANNERRequestPermission: {
            type: 'Conversation/Sequential Workflow',
            channel: 'initLifecycleChannel',
            steps: [
              {
                name: 'RequestPermission',
                type: 'Conversation/Trigger Event',
                event: {
                  type: 'MyOS/Single Document Permission Grant Requested',
                  onBehalfOf: 'ownerChannel',
                  requestId: 'REQ_PLANNER',
                  targetSessionId: "${document('/providerSessionId')}",
                  permissions: {
                    type: 'MyOS/Single Document Permission Set',
                    read: true,
                    singleOps: ['provideInstructions'],
                  },
                },
              },
            ],
          },
          aiPLANNERSubscribe: {
            type: 'Conversation/Sequential Workflow',
            channel: 'triggeredEventChannel',
            event: {
              type: 'MyOS/Single Document Permission Granted',
              inResponseTo: {
                requestId: 'REQ_PLANNER',
              },
            },
            steps: [
              {
                name: 'Subscribe',
                type: 'Conversation/Trigger Event',
                event: {
                  type: 'MyOS/Subscribe to Session Requested',
                  targetSessionId: "${document('/providerSessionId')}",
                  subscription: {
                    id: 'SUB_PLANNER',
                  },
                },
              },
            ],
          },
          aiPLANNERSubscriptionReady: {
            type: 'Conversation/Sequential Workflow',
            channel: 'triggeredEventChannel',
            event: {
              type: 'MyOS/Subscription to Session Initiated',
              subscriptionId: 'SUB_PLANNER',
            },
            steps: [
              {
                name: 'MarkPLANNERReady',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/planner/status',
                    val: 'ready',
                  },
                ],
              },
            ],
          },
          aiPLANNERPermissionRejected: {
            type: 'Conversation/Sequential Workflow',
            channel: 'triggeredEventChannel',
            event: {
              type: 'MyOS/Single Document Permission Rejected',
              inResponseTo: {
                requestId: 'REQ_PLANNER',
              },
            },
            steps: [
              {
                name: 'MarkPLANNERRevoked',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/planner/status',
                    val: 'revoked',
                  },
                ],
              },
            ],
          },
          requestSummary: {
            type: 'Conversation/Operation',
            channel: 'ownerChannel',
            description: 'Ask provider for a summary',
            request: {
              type: 'Text',
            },
          },
          requestSummaryImpl: {
            type: 'Conversation/Sequential Workflow Operation',
            operation: 'requestSummary',
            steps: [
              {
                name: 'AskPlanner',
                type: 'Conversation/Trigger Event',
                event: {
                  type: 'MyOS/Call Operation Requested',
                  onBehalfOf: 'ownerChannel',
                  targetSessionId: "${document('/providerSessionId')}",
                  operation: 'provideInstructions',
                  request: {
                    requester: 'PLANNER',
                    instructions:
                      "${'Return concise structured JSON.' + '\\n' + 'Prompt: ' + (document('/promptTemplate')) + '\\n' + 'Body: ' + (event.message.request)}",
                    context: "${document('/planner/context')}",
                    taskName: 'summarize',
                    expectedResponses: [
                      {
                        blueId: conversationBlueIds['Conversation/Response'],
                      },
                    ],
                  },
                },
              },
            ],
          },
          onSummaryResponse: {
            type: 'Conversation/Sequential Workflow',
            channel: 'triggeredEventChannel',
            event: {
              type: 'MyOS/Subscription Update',
              subscriptionId: 'SUB_PLANNER',
              update: {
                blueId: conversationBlueIds['Conversation/Response'],
                inResponseTo: {
                  incomingEvent: {
                    requester: 'PLANNER',
                  },
                },
              },
            },
            steps: [
              {
                name: '_SaveAIContext',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/planner/context',
                    val: '${event.update.context}',
                  },
                ],
              },
              {
                name: 'SaveAnswer',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/summary/output',
                    val: '${event.update.message}',
                  },
                ],
              },
              {
                name: 'MarkComplete',
                type: 'Conversation/Update Document',
                changeset: [
                  {
                    op: 'replace',
                    path: '/summary/status',
                    val: 'complete',
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

    expect(
      initialized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
            myOsBlueIds['MyOS/Single Document Permission Grant Requested'] &&
          event.getProperties()?.requestId?.getValue() === 'REQ_PLANNER',
      ),
    ).toBe(true);

    const granted = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Single Document Permission Granted',
          inResponseTo: {
            requestId: 'REQ_PLANNER',
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(
      granted.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
            myOsBlueIds['MyOS/Subscribe to Session Requested'] &&
          event
            .getProperties()
            ?.subscription?.getProperties()
            ?.id?.getValue() === 'SUB_PLANNER',
      ),
    ).toBe(true);

    const ready = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: granted.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription to Session Initiated',
          subscriptionId: 'SUB_PLANNER',
          targetSessionId: PROVIDER_SESSION_ID,
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(ready.document.get('/planner/status'))).toBe('ready');

    const asked = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: ready.document,
      timelineId: OWNER_TIMELINE_ID,
      operation: 'requestSummary',
      request: 'Balance forecast for next week',
    });

    const askEvent = asked.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Call Operation Requested'],
    );
    expect(askEvent).toBeDefined();
    expect(
      askEvent
        ?.getProperties()
        ?.request?.getProperties()
        ?.requester?.getValue(),
    ).toBe('PLANNER');

    const responded = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: asked.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_PLANNER',
          update: {
            type: 'Conversation/Response',
            message: 'Forecast ready',
            context: {
              lastPromptHash: 'abc123',
            },
            inResponseTo: {
              incomingEvent: {
                requester: 'PLANNER',
              },
            },
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(responded.document.get('/summary/status'))).toBe('complete');
    expect(String(responded.document.get('/summary/output'))).toBe(
      'Forecast ready',
    );
    expect(
      String(responded.document.get('/planner/context/lastPromptHash')),
    ).toBe('abc123');
  });
});
