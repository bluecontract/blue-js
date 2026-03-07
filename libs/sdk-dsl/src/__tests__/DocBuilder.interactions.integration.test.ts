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
});
