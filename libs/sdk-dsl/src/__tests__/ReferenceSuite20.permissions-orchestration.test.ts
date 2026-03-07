/*
Reference suite sources:
- docs/ts-dsl-sdk/reference-suites/suite-20-myos-stage4-permissions-and-orchestration.md
- references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-ldpg-request.it.test.ts
- references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-wapg.it.test.ts
- references/lcloud/lcloud-develop/tests/integration/tests-myos-admin/myos-admin-worker-session.it.test.ts
*/

import { DocBuilder } from '../lib';
import {
  initializeDocument,
  makeTimelineEntryEvent,
  processExternalEvent,
} from './processor-harness';
import {
  assertReferenceDocMatchesDsl,
  assertReferenceEventListsMatchDsl,
  assertReferenceNodeMatchesDsl,
  referenceDocToNode,
} from './reference-suite-support';

function buildReferenceLdpgWatcherDocument(options: {
  readonly runId: string;
  readonly targetSessionId: string;
  readonly requestId: string;
}): Record<string, unknown> {
  return {
    name: `LDPG Watcher - ${options.runId}`,
    type: 'MyOS/MyOS Admin Base',
    grantSeenCount: 0,
    lastGrantedTargetSessionId: null,
    contracts: {
      ownerChannel: { type: 'MyOS/MyOS Timeline Channel' },
      myOsAdminChannel: { type: 'MyOS/MyOS Timeline Channel' },
      triggeredEventChannel: { type: 'Core/Triggered Event Channel' },
      initLifecycleChannel: {
        type: 'Core/Lifecycle Event Channel',
        event: { type: 'Core/Document Processing Initiated' },
      },
      emitLdpgRequest: {
        type: 'Conversation/Sequential Workflow',
        channel: 'initLifecycleChannel',
        steps: [
          {
            name: 'RequestLinkedDocumentsPermission',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'MyOS/Linked Documents Permission Grant Requested',
              onBehalfOf: 'ownerChannel',
              targetSessionId: options.targetSessionId,
              links: {
                anchorA: { read: true },
              },
              requestId: options.requestId,
            },
          },
        ],
      },
      markGrantSeen: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Single Document Permission Granted',
          inResponseTo: { requestId: options.requestId },
        },
        steps: [
          {
            name: 'UpdateGrantSeen',
            type: 'Conversation/Update Document',
            changeset: [
              {
                op: 'replace',
                path: '/grantSeenCount',
                val: '${document("/grantSeenCount") + 1}',
              },
              {
                op: 'replace',
                path: '/lastGrantedTargetSessionId',
                val: '${event.targetSessionId && event.targetSessionId.value !== undefined ? event.targetSessionId.value : event.targetSessionId}',
              },
            ],
          },
        ],
      },
    },
  };
}

function buildDslLdpgWatcherDocument(options: {
  readonly runId: string;
  readonly targetSessionId: string;
  readonly requestId: string;
}) {
  return DocBuilder.doc()
    .name(`LDPG Watcher - ${options.runId}`)
    .type('MyOS/MyOS Admin Base')
    .field('/grantSeenCount', 0)
    .field('/lastGrantedTargetSessionId', null)
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('myOsAdminChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('triggeredEventChannel', { type: 'Core/Triggered Event Channel' })
    .channel('initLifecycleChannel', {
      type: 'Core/Lifecycle Event Channel',
      event: { type: 'Core/Document Processing Initiated' },
    })
    .onInit('emitLdpgRequest', (steps) =>
      steps.myOs().requestLinkedDocsPermission(
        'ownerChannel',
        options.requestId,
        options.targetSessionId,
        {
          anchorA: { read: true },
        },
        {
          stepName: 'RequestLinkedDocumentsPermission',
        },
      ),
    )
    .onMyOsResponse(
      'markGrantSeen',
      'MyOS/Single Document Permission Granted',
      options.requestId,
      (steps) =>
        steps.updateDocument('UpdateGrantSeen', (changeset) =>
          changeset
            .replaceExpression(
              '/grantSeenCount',
              'document("/grantSeenCount") + 1',
            )
            .replaceExpression(
              '/lastGrantedTargetSessionId',
              'event.targetSessionId && event.targetSessionId.value !== undefined ? event.targetSessionId.value : event.targetSessionId',
            ),
        ),
    )
    .buildDocument();
}

function buildReferenceWorkerAgencyRequesterDocument(options: {
  readonly runId: string;
  readonly grantName: string;
}): Record<string, unknown> {
  return {
    name: `Worker Agency Requester - ${options.runId}`,
    type: 'MyOS/MyOS Admin Base',
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      myOsAdminChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      initLifecycleChannel: {
        type: 'Core/Lifecycle Event Channel',
        event: {
          type: 'Core/Document Processing Initiated',
        },
      },
      emitWorkerAgencyPermissionRequest: {
        type: 'Conversation/Sequential Workflow',
        channel: 'initLifecycleChannel',
        steps: [
          {
            name: 'EmitWorkerAgencyPermissionRequest',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'MyOS/Worker Agency Permission Grant Requested',
              onBehalfOf: 'ownerChannel',
              name: options.grantName,
              allowedWorkerAgencyPermissions: [
                {
                  type: 'MyOS/Worker Agency Permission',
                  workerType: 'MyOS/MyOS Admin Base',
                  permissions: {
                    read: true,
                    allOps: true,
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };
}

function buildDslWorkerAgencyRequesterDocument(options: {
  readonly runId: string;
  readonly grantName: string;
}) {
  return DocBuilder.doc()
    .name(`Worker Agency Requester - ${options.runId}`)
    .type('MyOS/MyOS Admin Base')
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('myOsAdminChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('initLifecycleChannel', {
      type: 'Core/Lifecycle Event Channel',
      event: {
        type: 'Core/Document Processing Initiated',
      },
    })
    .onInit('emitWorkerAgencyPermissionRequest', (steps) =>
      steps.myOs().grantWorkerAgencyPermission(
        'ownerChannel',
        undefined,
        [
          {
            type: 'MyOS/Worker Agency Permission',
            workerType: 'MyOS/MyOS Admin Base',
            permissions: {
              read: true,
              allOps: true,
            },
          },
        ],
        {
          stepName: 'EmitWorkerAgencyPermissionRequest',
          name: options.grantName,
        },
      ),
    )
    .buildDocument();
}

function buildChildWorkerDocument(runId: string) {
  return {
    name: `Child Worker Session - ${runId}`,
    type: 'MyOS/MyOS Admin Base',
    contracts: {
      ownerChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
      myOsAdminChannel: {
        type: 'MyOS/MyOS Timeline Channel',
      },
    },
  };
}

function buildReferenceWorkerSessionRequesterDocument(options: {
  readonly runId: string;
  readonly grantName: string;
  readonly requestId: string;
}): Record<string, unknown> {
  return {
    name: `Worker Agency Requester - ${options.runId}`,
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
      emitWorkerAgencyPermissionRequest: {
        type: 'Conversation/Sequential Workflow',
        channel: 'initLifecycleChannel',
        steps: [
          {
            name: 'EmitWorkerAgencyPermissionRequest',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'MyOS/Worker Agency Permission Grant Requested',
              onBehalfOf: 'ownerChannel',
              name: options.grantName,
              allowedWorkerAgencyPermissions: [
                {
                  type: 'MyOS/Worker Agency Permission',
                  workerType: 'MyOS/MyOS Admin Base',
                  permissions: {
                    read: true,
                    allOps: true,
                  },
                },
              ],
            },
          },
        ],
      },
      handleAdminEvents: {
        type: 'Conversation/Sequential Workflow',
        channel: 'triggeredEventChannel',
        event: {
          type: 'MyOS/Worker Agency Permission Granted',
        },
        steps: [
          {
            name: 'TriggerStartWorkerSession',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'MyOS/Start Worker Session Requested',
              onBehalfOf: 'ownerChannel',
              document: buildChildWorkerDocument(options.runId),
              channelBindings: {
                ownerChannel: { accountId: 'owner-account-id' },
                myOsAdminChannel: { accountId: '0' },
              },
              requestId: options.requestId,
            },
          },
        ],
      },
    },
  };
}

function buildDslWorkerSessionRequesterDocument(options: {
  readonly runId: string;
  readonly grantName: string;
  readonly requestId: string;
}) {
  return DocBuilder.doc()
    .name(`Worker Agency Requester - ${options.runId}`)
    .type('MyOS/MyOS Admin Base')
    .channel('ownerChannel', { type: 'MyOS/MyOS Timeline Channel' })
    .channel('triggeredEventChannel', { type: 'Core/Triggered Event Channel' })
    .channel('initLifecycleChannel', {
      type: 'Core/Lifecycle Event Channel',
      event: {
        type: 'Core/Document Processing Initiated',
      },
    })
    .onInit('emitWorkerAgencyPermissionRequest', (steps) =>
      steps.myOs().grantWorkerAgencyPermission(
        'ownerChannel',
        undefined,
        [
          {
            type: 'MyOS/Worker Agency Permission',
            workerType: 'MyOS/MyOS Admin Base',
            permissions: {
              read: true,
              allOps: true,
            },
          },
        ],
        {
          stepName: 'EmitWorkerAgencyPermissionRequest',
          name: options.grantName,
        },
      ),
    )
    .onEvent(
      'handleAdminEvents',
      'MyOS/Worker Agency Permission Granted',
      (steps) =>
        steps.myOs().startWorkerSession(
          'ownerChannel',
          buildChildWorkerDocument(options.runId),
          {
            ownerChannel: { accountId: 'owner-account-id' },
            myOsAdminChannel: { accountId: '0' },
          },
          (session) => session.requestId(options.requestId),
          'TriggerStartWorkerSession',
        ),
    )
    .buildDocument();
}

async function initializePair(
  referenceDocument: Record<string, unknown>,
  dslDocument: ReturnType<typeof DocBuilder.doc> extends never ? never : any,
) {
  const reference = await initializeDocument(
    referenceDocToNode(referenceDocument),
  );
  const dsl = await initializeDocument(dslDocument);
  return {
    reference,
    dsl,
  };
}

describe('Reference Suite 20 — MyOS stage 4 permissions and orchestration', () => {
  describe('MYOS-S4-02 — LDPG request + watcher', () => {
    it('matches the watcher reference document structurally', () => {
      const options = {
        runId: 'suite20-ldpg',
        targetSessionId: 'base-session-1',
        requestId: 'ldpg-watch-1',
      };

      assertReferenceDocMatchesDsl(
        buildReferenceLdpgWatcherDocument(options),
        buildDslLdpgWatcherDocument(options),
      );
    });

    it('matches the reference runtime for request emission and correlated grant observation', async () => {
      const options = {
        runId: 'suite20-ldpg-runtime',
        targetSessionId: 'base-session-1',
        requestId: 'ldpg-watch-1',
      };

      const { reference, dsl } = await initializePair(
        buildReferenceLdpgWatcherDocument(options),
        buildDslLdpgWatcherDocument(options),
      );

      assertReferenceEventListsMatchDsl(
        reference.triggeredEvents,
        dsl.triggeredEvents,
      );

      const grantedMessage = {
        type: 'MyOS/Single Document Permission Granted',
        inResponseTo: {
          requestId: options.requestId,
        },
        targetSessionId: options.targetSessionId,
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

      assertReferenceNodeMatchesDsl(
        referenceGranted.document,
        dslGranted.document,
      );
    });
  });

  describe('MYOS-S4-04 — Worker agency permission lifecycle', () => {
    it('matches the requester reference document structurally', () => {
      const options = {
        runId: 'suite20-wapg',
        grantName: 'WAPG-suite20',
      };

      assertReferenceDocMatchesDsl(
        buildReferenceWorkerAgencyRequesterDocument(options),
        buildDslWorkerAgencyRequesterDocument(options),
      );
    });

    it('matches the reference runtime for initial permission request emission', async () => {
      const options = {
        runId: 'suite20-wapg-runtime',
        grantName: 'WAPG-runtime',
      };

      const { reference, dsl } = await initializePair(
        buildReferenceWorkerAgencyRequesterDocument(options),
        buildDslWorkerAgencyRequesterDocument(options),
      );

      assertReferenceEventListsMatchDsl(
        reference.triggeredEvents,
        dsl.triggeredEvents,
      );
      assertReferenceNodeMatchesDsl(reference.document, dsl.document);
    });
  });

  describe('MYOS-S4-05 — Worker session startup', () => {
    it('matches the requester reference document structurally', () => {
      const options = {
        runId: 'suite20-worker-session',
        grantName: 'WAPG-worker-session',
        requestId: 'WAPG-worker-session-req',
      };

      assertReferenceDocMatchesDsl(
        buildReferenceWorkerSessionRequesterDocument(options),
        buildDslWorkerSessionRequesterDocument(options),
      );
    });

    it('matches the reference runtime for granted -> start-worker-session emission', async () => {
      const options = {
        runId: 'suite20-worker-session-runtime',
        grantName: 'WAPG-worker-session-runtime',
        requestId: 'WAPG-worker-session-req',
      };

      const { reference, dsl } = await initializePair(
        buildReferenceWorkerSessionRequesterDocument(options),
        buildDslWorkerSessionRequesterDocument(options),
      );

      assertReferenceEventListsMatchDsl(
        reference.triggeredEvents,
        dsl.triggeredEvents,
      );

      const grantedMessage = {
        type: 'MyOS/Worker Agency Permission Granted',
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

      assertReferenceEventListsMatchDsl(
        referenceGranted.triggeredEvents,
        dslGranted.triggeredEvents,
      );
      assertReferenceNodeMatchesDsl(
        referenceGranted.document,
        dslGranted.document,
      );
    });
  });
});
