/*
Java references:
- references/java-sdk/src/test/java/blue/language/sdk/dsl/DocBuilderInteractionsDslParityTest.java
*/

import { blueIds as myOsBlueIds } from '@blue-repository/types/packages/myos/blue-ids';

import { DocBuilder } from '../lib';
import {
  getStoredDocumentBlueId,
  initializeDocument,
  processOperationRequest,
} from './processor-harness';

const ADMIN_TIMELINE_ID = 'myos-admin-stage4';
const OWNER_TIMELINE_ID = 'owner-stage4';
const REMOTE_SESSION_ID = 'remote-provider-session';

describe('DocBuilder interactions integration', () => {
  it('runs a single-document access flow through grant and subscription-ready events', async () => {
    const built = DocBuilder.doc()
      .name('Access integration')
      .field('/catalogSessionId', REMOTE_SESSION_ID)
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
      .onBehalfOf('ownerChannel')
      .read(true)
      .operations('search')
      .subscribeAfterGranted()
      .subscriptionEvents('MyOS/Session Epoch Advanced')
      .statusPath('/catalog/status')
      .done()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    expect(String(initialized.document.get('/catalog/status'))).toBe('pending');
    expect(
      initialized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
            myOsBlueIds['MyOS/Single Document Permission Grant Requested'] &&
          event.getProperties()?.requestId?.getValue() === 'REQ_ACCESS_CATALOG',
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
            requestId: 'REQ_ACCESS_CATALOG',
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(granted.document.get('/catalog/status'))).toBe('granted');
    const subscribeEvent = granted.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Subscribe to Session Requested'],
    );
    expect(subscribeEvent).toBeDefined();
    expect(
      subscribeEvent
        ?.getProperties()
        ?.subscription?.getProperties()
        ?.id?.getValue(),
    ).toBe('SUB_ACCESS_CATALOG');

    const subscriptionReady = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: granted.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription to Session Initiated',
          subscriptionId: 'SUB_ACCESS_CATALOG',
          targetSessionId: REMOTE_SESSION_ID,
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(subscriptionReady.document.get('/catalog/status'))).toBe(
      'subscribed',
    );
  });

  it('runs a linked-documents access flow and correlates granted events by requestId', async () => {
    const built = DocBuilder.doc()
      .name('Linked access integration')
      .field('/projectSessionId', 'project-session-1')
      .accessLinked('projectData')
      .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
      .onBehalfOf('ownerChannel')
      .statusPath('/projectData/status')
      .link('invoices')
      .read(true)
      .operations('list')
      .done()
      .done()
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    expect(
      initialized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
            myOsBlueIds['MyOS/Linked Documents Permission Grant Requested'] &&
          event.getProperties()?.requestId?.getValue() ===
            'REQ_LINKED_ACCESS_PROJECTDATA',
      ),
    ).toBe(true);

    const wrongGrant = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Linked Documents Permission Granted',
          inResponseTo: {
            requestId: 'REQ_OTHER',
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(wrongGrant.document.get('/projectData/status'))).toBe(
      'pending',
    );

    const granted = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: wrongGrant.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Linked Documents Permission Granted',
          inResponseTo: {
            requestId: 'REQ_LINKED_ACCESS_PROJECTDATA',
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(granted.document.get('/projectData/status'))).toBe('granted');
  });

  it('runs a worker-agency flow and emits worker-session start after grant', async () => {
    const built = DocBuilder.doc()
      .name('Agency integration')
      .agency('procurement')
      .onBehalfOf('ownerChannel')
      .allowedOperations('propose')
      .statusPath('/agency/status')
      .done()
      .onAgencyGranted('procurement', 'startWorkerFlow', (steps) =>
        steps.viaAgency('procurement').startSession(
          'StartProcurementWorker',
          {
            name: 'Purchase Workspace',
          },
          (bindings) => bindings.bind('sellerChannel', 'vendor@example.com'),
          (options) =>
            options
              .defaultMessage('Negotiation started')
              .capabilities((caps) => caps.participantsOrchestration(true)),
        ),
      )
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    expect(
      initialized.triggeredEvents.some(
        (event) =>
          event.getType()?.getBlueId() ===
            myOsBlueIds['MyOS/Worker Agency Permission Grant Requested'] &&
          event.getProperties()?.requestId?.getValue() ===
            'REQ_AGENCY_PROCUREMENT',
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
          type: 'MyOS/Worker Agency Permission Granted',
          inResponseTo: {
            requestId: 'REQ_AGENCY_PROCUREMENT',
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(granted.document.get('/agency/status'))).toBe('granted');

    const startSessionEvent = granted.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Start Worker Session Requested'],
    );
    expect(startSessionEvent).toBeDefined();
    expect(
      startSessionEvent
        ?.getProperties()
        ?.channelBindings?.getProperties()
        ?.sellerChannel?.getProperties()
        ?.email?.getValue(),
    ).toBe('vendor@example.com');
    expect(
      startSessionEvent
        ?.getProperties()
        ?.capabilities?.getProperties()
        ?.participantsOrchestration?.getValue(),
    ).toBe(true);
  });

  it('keeps stage-3 subscription handlers composable with stage-4 access builders', async () => {
    const built = DocBuilder.doc()
      .name('Stage 3 + Stage 4 composition')
      .field('/catalogSessionId', REMOTE_SESSION_ID)
      .field('/epochStatus', 'idle')
      .access('catalog')
      .targetSessionId(DocBuilder.expr("document('/catalogSessionId')"))
      .onBehalfOf('ownerChannel')
      .subscribeAfterGranted()
      .done()
      .onSubscriptionUpdate(
        'onCatalogEpoch',
        'SUB_ACCESS_CATALOG',
        'MyOS/Session Epoch Advanced',
        (steps) =>
          steps.replaceValue('MarkEpochAdvanced', '/epochStatus', 'advanced'),
      )
      .channel('myOsAdminChannel', {
        timelineId: ADMIN_TIMELINE_ID,
      })
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

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
            requestId: 'REQ_ACCESS_CATALOG',
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
          myOsBlueIds['MyOS/Subscribe to Session Requested'],
      ),
    ).toBe(true);

    const updated = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: granted.document,
      timelineId: ADMIN_TIMELINE_ID,
      operation: 'myOsAdminUpdate',
      request: [
        {
          type: 'MyOS/Subscription Update',
          subscriptionId: 'SUB_ACCESS_CATALOG',
          update: {
            type: 'MyOS/Session Epoch Advanced',
            epoch: 2,
          },
        },
      ],
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    expect(String(updated.document.get('/epochStatus'))).toBe('advanced');
  });

  it('emits linked-access step-helper events from an operation workflow', async () => {
    const built = DocBuilder.doc()
      .name('Linked access helper integration')
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/projectSessionId', 'project-session-9')
      .accessLinked('projectData')
      .targetSessionId(DocBuilder.expr("document('/projectSessionId')"))
      .onBehalfOf('ownerChannel')
      .requestPermissionManually()
      .link('invoices')
      .read(true)
      .operations('list')
      .done()
      .done()
      .operation('sync')
      .channel('ownerChannel')
      .description('Synchronize linked project state')
      .requestType('Boolean')
      .steps((steps) =>
        steps
          .accessLinked('projectData')
          .requestPermission('RequestLinkedProject')
          .accessLinked('projectData')
          .call('refreshProject', {
            mode: 'full',
          })
          .accessLinked('projectData')
          .subscribe('WatchProject', 'MyOS/Session Epoch Advanced')
          .accessLinked('projectData')
          .revokePermission('RevokeLinkedProject'),
      )
      .done()
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: OWNER_TIMELINE_ID,
      operation: 'sync',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const linkedGrant = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Linked Documents Permission Grant Requested'],
    );
    expect(linkedGrant).toBeDefined();
    expect(linkedGrant?.getProperties()?.requestId?.getValue()).toBe(
      'REQ_LINKED_ACCESS_PROJECTDATA',
    );

    const callRequest = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Call Operation Requested'],
    );
    expect(callRequest).toBeDefined();
    expect(callRequest?.getProperties()?.operation?.getValue()).toBe(
      'refreshProject',
    );
    expect(callRequest?.getProperties()?.targetSessionId?.getValue()).toBe(
      'project-session-9',
    );

    const subscriptionRequest = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Subscribe to Session Requested'],
    );
    expect(subscriptionRequest).toBeDefined();
    expect(
      subscriptionRequest
        ?.getProperties()
        ?.subscription?.getProperties()
        ?.id?.getValue(),
    ).toBe('SUB_LINKED_ACCESS_PROJECTDATA');

    const revokeRequest = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Linked Documents Permission Revoke Requested'],
    );
    expect(revokeRequest).toBeDefined();
    expect(revokeRequest?.getProperties()?.requestId?.getValue()).toBe(
      'REQ_LINKED_ACCESS_PROJECTDATA',
    );
  });

  it('emits agency call, subscribe, and revoke helper events when targetSessionId is configured', async () => {
    const built = DocBuilder.doc()
      .name('Agency helper integration')
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: OWNER_TIMELINE_ID,
      })
      .field('/workerSessionId', 'worker-session-11')
      .agency('procurement')
      .onBehalfOf('ownerChannel')
      .targetSessionId(DocBuilder.expr("document('/workerSessionId')"))
      .allowedOperations('propose')
      .requestPermissionManually()
      .done()
      .operation('coordinate')
      .channel('ownerChannel')
      .description('Coordinate the worker agency')
      .requestType('Boolean')
      .steps((steps) =>
        steps
          .viaAgency('procurement')
          .requestPermission('GrantProcurement')
          .viaAgency('procurement')
          .call('propose', {
            proposalId: 'P-1',
          })
          .viaAgency('procurement')
          .subscribe('WatchWorker', 'MyOS/Session Epoch Advanced')
          .viaAgency('procurement')
          .revokePermission('RevokeProcurement'),
      )
      .done()
      .buildDocument();

    const initialized = await initializeDocument(built);
    const storedBlueId = getStoredDocumentBlueId(initialized.document);

    const processed = await processOperationRequest({
      blue: initialized.blue,
      processor: initialized.processor,
      document: initialized.document,
      timelineId: OWNER_TIMELINE_ID,
      operation: 'coordinate',
      request: true,
      allowNewerVersion: false,
      documentBlueId: storedBlueId,
    });

    const agencyGrant = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Worker Agency Permission Grant Requested'],
    );
    expect(agencyGrant).toBeDefined();
    expect(agencyGrant?.getProperties()?.requestId?.getValue()).toBe(
      'REQ_AGENCY_PROCUREMENT',
    );

    const callRequest = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Call Operation Requested'],
    );
    expect(callRequest).toBeDefined();
    expect(callRequest?.getProperties()?.targetSessionId?.getValue()).toBe(
      'worker-session-11',
    );
    expect(callRequest?.getProperties()?.operation?.getValue()).toBe('propose');

    const subscriptionRequest = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Subscribe to Session Requested'],
    );
    expect(subscriptionRequest).toBeDefined();
    expect(
      subscriptionRequest
        ?.getProperties()
        ?.subscription?.getProperties()
        ?.id?.getValue(),
    ).toBe('SUB_AGENCY_PROCUREMENT');

    const revokeRequest = processed.triggeredEvents.find(
      (event) =>
        event.getType()?.getBlueId() ===
        myOsBlueIds['MyOS/Worker Agency Permission Revoke Requested'],
    );
    expect(revokeRequest).toBeDefined();
    expect(revokeRequest?.getProperties()?.requestId?.getValue()).toBe(
      'REQ_AGENCY_PROCUREMENT',
    );
  });
});
