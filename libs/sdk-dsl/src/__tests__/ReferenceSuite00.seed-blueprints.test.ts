/*
Reference suite sources:
- docs/ts-dsl-sdk/reference-suites/suite-00-seed-blueprints.md
- references/lcloud/lcloud-develop/tests/integration/tests-db/docHelpers.ts
*/

import { DocBuilder } from '../lib';
import {
  initializeDocument,
  makeTimelineEntryEvent,
  processExternalEvent,
  processOperationRequest,
} from './processor-harness';
import {
  assertReferenceDocMatchesDsl,
  assertReferenceEventListsMatchDsl,
  assertReferenceNodeMatchesDsl,
  referenceDocToNode,
} from './reference-suite-support';

const EMIT_CALL_OPERATION_REQUESTED_CODE = `
            const payload = event.message.request;
            if (!payload || typeof payload !== 'object') {
              throw new Error('dispatchCall expects object payload');
            }
            const { targetSessionId, operation, payload: body } = payload;
            if (!targetSessionId) {
              throw new Error('dispatchCall missing targetSessionId');
            }
            if (!operation) {
              throw new Error('dispatchCall missing operation');
            }
            return {
              events: [
                {
                  type: 'MyOS/Call Operation Requested',
                  onBehalfOf: 'ownerChannel',
                  targetSessionId,
                  operation,
                  request: body ?? '',
                },
              ],
            };
          `;

const EMIT_ADDING_PARTICIPANT_REQUESTED_CODE = `
            const payload = event.message.request;
            if (!payload || typeof payload !== 'object') {
              throw new Error('dispatchParticipantAddition expects object payload');
            }
            const { requestId, channelName, participantBinding } = payload;
            if (!requestId) {
              throw new Error('dispatchParticipantAddition missing requestId');
            }
            if (!channelName) {
              throw new Error('dispatchParticipantAddition missing channelName');
            }
            const addEvent = {
              type: 'MyOS/Adding Participant Requested',
              requestId,
              channelName,
            };
            if (participantBinding && typeof participantBinding === 'object') {
              addEvent.participantBinding = participantBinding;
            }
            return { events: [addEvent] };
          `;

const EMIT_REMOVING_PARTICIPANT_REQUESTED_CODE = `
            const payload = event.message.request;
            if (!payload || typeof payload !== 'object') {
              throw new Error('dispatchParticipantRemoval expects object payload');
            }
            const { requestId, channelName } = payload;

            if (!channelName) {
              throw new Error('dispatchParticipantRemoval missing channelName');
            }
            return {
              events: [
                {
                  type: 'MyOS/Removing Participant Requested',
                  requestId,
                  channelName,
                },
              ],
            };
          `;

function buildReferenceCallOperationRequestDocument(
  runId: string,
): Record<string, unknown> {
  return {
    name: `Call Operation Idempotency ${runId}`,
    type: 'MyOS/MyOS Admin Base',
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
      initLifecycleChannel: {
        type: 'Core/Lifecycle Event Channel',
        event: {
          type: 'Core/Document Processing Initiated',
        },
      },
      dispatchCall: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        request: {
          targetSessionId: { type: 'Text' },
          operation: { type: 'Text' },
          payload: { type: 'Text' },
        },
      },
      dispatchCallImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'dispatchCall',
        steps: [
          {
            name: 'EmitCallOperationRequested',
            type: 'Conversation/JavaScript Code',
            code: EMIT_CALL_OPERATION_REQUESTED_CODE,
          },
        ],
      },
    },
  };
}

function buildDslCallOperationRequestDocument(runId: string) {
  return DocBuilder.doc()
    .name(`Call Operation Idempotency ${runId}`)
    .type('MyOS/MyOS Admin Base')
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('myOsAdminChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('triggeredEventChannel', { type: 'Core/Triggered Event Channel' })
    .channel('initLifecycleChannel', {
      type: 'Core/Lifecycle Event Channel',
      event: {
        type: 'Core/Document Processing Initiated',
      },
    })
    .operation('dispatchCall')
    .channel('ownerChannel')
    .request({
      targetSessionId: { type: 'Text' },
      operation: { type: 'Text' },
      payload: { type: 'Text' },
    })
    .steps((steps) =>
      steps.jsRaw(
        'EmitCallOperationRequested',
        EMIT_CALL_OPERATION_REQUESTED_CODE,
      ),
    )
    .done()
    .buildDocument();
}

function buildReferenceParticipantsOrchestrationDocument(
  runId: string,
): Record<string, unknown> {
  return {
    name: `Participants Orchestration Fixture ${runId}`,
    type: 'MyOS/MyOS Admin Base',
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      triggeredEventChannel: {
        type: 'Core/Triggered Event Channel',
      },
      initLifecycleChannel: {
        type: 'Core/Lifecycle Event Channel',
        event: {
          type: 'Core/Document Processing Initiated',
        },
      },
      myOsAdminChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      addApprovedParticipant: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Participant Resolved',
        },
        steps: [
          {
            name: 'ApplyApprovedContracts',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'add',
                path: '${"/contracts/" + event.channelName}',
                val: '${{ "type": "MyOS/MyOS Timeline Channel", "accountId": event.participant.accountId, "timelineId": event.participant.timelineId }}',
              },
            ],
          },
        ],
      },
      removeApprovedParticipant: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Removing Participant Responded',
        },
        steps: [
          {
            name: 'ApplyApprovedContracts',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'remove',
                path: '${"/contracts/" + event.request.channelName}',
              },
            ],
          },
        ],
      },
      participantsOrchestration: {
        type: 'MyOS/MyOS Participants Orchestration',
      },
      dispatchParticipantAddition: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        request: {
          requestId: { type: 'Text' },
          channelName: { type: 'Text' },
          participantBinding: {
            accountId: { type: 'Text' },
            email: { type: 'Text' },
          },
        },
      },
      dispatchParticipantAdditionImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'dispatchParticipantAddition',
        steps: [
          {
            name: 'EmitAddingParticipantRequested',
            type: 'Conversation/JavaScript Code',
            code: EMIT_ADDING_PARTICIPANT_REQUESTED_CODE,
          },
        ],
      },
      dispatchParticipantRemoval: {
        type: 'Conversation/Operation',
        channel: 'ownerChannel',
        request: {
          requestId: { type: 'Text' },
          channelName: { type: 'Text' },
        },
      },
      dispatchParticipantRemovalImpl: {
        type: 'Conversation/Sequential Workflow Operation',
        operation: 'dispatchParticipantRemoval',
        steps: [
          {
            name: 'EmitRemovingParticipantRequested',
            type: 'Conversation/JavaScript Code',
            code: EMIT_REMOVING_PARTICIPANT_REQUESTED_CODE,
          },
        ],
      },
      reviewerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
    },
  };
}

function buildDslParticipantsOrchestrationDocument(runId: string) {
  return DocBuilder.doc()
    .name(`Participants Orchestration Fixture ${runId}`)
    .type('MyOS/MyOS Admin Base')
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('triggeredEventChannel', { type: 'Core/Triggered Event Channel' })
    .channel('initLifecycleChannel', {
      type: 'Core/Lifecycle Event Channel',
      event: {
        type: 'Core/Document Processing Initiated',
      },
    })
    .channel('myOsAdminChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .onEvent('addApprovedParticipant', 'MyOS/Participant Resolved', (steps) =>
      steps.updateDocument('ApplyApprovedContracts', (changeset) =>
        changeset.addValue(
          DocBuilder.expr('"/contracts/" + event.channelName'),
          DocBuilder.expr(
            '{ "type": "MyOS/MyOS Timeline Channel", "accountId": event.participant.accountId, "timelineId": event.participant.timelineId }',
          ),
        ),
      ),
    )
    .onEvent(
      'removeApprovedParticipant',
      'MyOS/Removing Participant Responded',
      (steps) =>
        steps.updateDocument('ApplyApprovedContracts', (changeset) =>
          changeset.remove(
            DocBuilder.expr('"/contracts/" + event.request.channelName'),
          ),
        ),
    )
    .field('/contracts/participantsOrchestration', {
      type: 'MyOS/MyOS Participants Orchestration',
    })
    .operation('dispatchParticipantAddition')
    .channel('ownerChannel')
    .request({
      requestId: { type: 'Text' },
      channelName: { type: 'Text' },
      participantBinding: {
        accountId: { type: 'Text' },
        email: { type: 'Text' },
      },
    })
    .steps((steps) =>
      steps.jsRaw(
        'EmitAddingParticipantRequested',
        EMIT_ADDING_PARTICIPANT_REQUESTED_CODE,
      ),
    )
    .done()
    .operation('dispatchParticipantRemoval')
    .channel('ownerChannel')
    .request({
      requestId: { type: 'Text' },
      channelName: { type: 'Text' },
    })
    .steps((steps) =>
      steps.jsRaw(
        'EmitRemovingParticipantRequested',
        EMIT_REMOVING_PARTICIPANT_REQUESTED_CODE,
      ),
    )
    .done()
    .channel('reviewerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .buildDocument();
}

describe('Reference Suite 00 — Seed blueprints', () => {
  describe('DOC-SEED-05 — Call operation request document', () => {
    it('matches the reference blueprint structurally', () => {
      const runId = 'suite00-call';
      assertReferenceDocMatchesDsl(
        buildReferenceCallOperationRequestDocument(runId),
        buildDslCallOperationRequestDocument(runId),
      );
    });

    it('matches the reference runtime behavior for emitted call-operation requests', async () => {
      const runId = 'suite00-call-runtime';
      const reference = await initializeDocument(
        referenceDocToNode(buildReferenceCallOperationRequestDocument(runId)),
      );
      const dsl = await initializeDocument(
        buildDslCallOperationRequestDocument(runId),
      );

      const request = {
        targetSessionId: 'target-session-1',
        operation: 'increment',
        payload: 'payload-body',
      };

      const referenceResult = await processOperationRequest({
        blue: reference.blue,
        processor: reference.processor,
        document: reference.document,
        timelineId: 'owner-timeline',
        operation: 'dispatchCall',
        request,
      });
      const dslResult = await processOperationRequest({
        blue: dsl.blue,
        processor: dsl.processor,
        document: dsl.document,
        timelineId: 'owner-timeline',
        operation: 'dispatchCall',
        request,
      });

      assertReferenceEventListsMatchDsl(
        referenceResult.triggeredEvents,
        dslResult.triggeredEvents,
      );
      assertReferenceNodeMatchesDsl(
        referenceResult.document,
        dslResult.document,
      );
    });
  });

  describe('DOC-SEED-01 — Participants orchestration document', () => {
    it('matches the reference blueprint structurally', () => {
      const runId = 'suite00-participants';
      assertReferenceDocMatchesDsl(
        buildReferenceParticipantsOrchestrationDocument(runId),
        buildDslParticipantsOrchestrationDocument(runId),
      );
    });

    it('matches the reference runtime behavior for participant request emission and approved contract application', async () => {
      const runId = 'suite00-participants-runtime';
      const reference = await initializeDocument(
        referenceDocToNode(
          buildReferenceParticipantsOrchestrationDocument(runId),
        ),
      );
      const dsl = await initializeDocument(
        buildDslParticipantsOrchestrationDocument(runId),
      );

      const request = {
        requestId: 'REQ_PARTICIPANT_1',
        channelName: 'buyerChannel',
        participantBinding: {
          accountId: 'buyer-account',
          email: 'buyer@example.com',
        },
      };

      const referenceRequested = await processOperationRequest({
        blue: reference.blue,
        processor: reference.processor,
        document: reference.document,
        timelineId: 'owner-timeline',
        operation: 'dispatchParticipantAddition',
        request,
      });
      const dslRequested = await processOperationRequest({
        blue: dsl.blue,
        processor: dsl.processor,
        document: dsl.document,
        timelineId: 'owner-timeline',
        operation: 'dispatchParticipantAddition',
        request,
      });

      assertReferenceEventListsMatchDsl(
        referenceRequested.triggeredEvents,
        dslRequested.triggeredEvents,
      );
      assertReferenceNodeMatchesDsl(
        referenceRequested.document,
        dslRequested.document,
      );

      const participantResolvedMessage = {
        type: 'MyOS/Participant Resolved',
        channelName: 'buyerChannel',
        participant: {
          accountId: 'buyer-account',
          timelineId: 'buyer-timeline',
        },
      };

      const referenceApproved = await processExternalEvent({
        processor: reference.processor,
        document: referenceRequested.document,
        event: makeTimelineEntryEvent(reference.blue, {
          timelineId: 'myos-admin-timeline',
          message: participantResolvedMessage,
        }),
      });
      const dslApproved = await processExternalEvent({
        processor: dsl.processor,
        document: dslRequested.document,
        event: makeTimelineEntryEvent(dsl.blue, {
          timelineId: 'myos-admin-timeline',
          message: participantResolvedMessage,
        }),
      });

      assertReferenceNodeMatchesDsl(
        referenceApproved.document,
        dslApproved.document,
      );
    });
  });
});
