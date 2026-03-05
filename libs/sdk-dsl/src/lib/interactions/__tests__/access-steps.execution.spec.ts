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

describe('access step helpers execution', () => {
  it('emits permission and subscription requests through access steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_ACCESS')
      .subscriptionId('SUB_ACCESS')
      .done()
      .operation(
        'bootstrapAccess',
        'ownerChannel',
        Number,
        'bootstrap access',
        (steps) =>
          steps
            .access('counterAccess')
            .requestPermission(
              {
                read: true,
                write: true,
              },
              true,
            )
            .access('counterAccess')
            .subscribe('Conversation/Response'),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'access runtime initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'bootstrapAccess',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'access bootstrap operation failed',
    );
    const eventTypes = processed.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(eventTypes).toContain(
      'MyOS/Single Document Permission Grant Requested',
    );
    expect(eventTypes).toContain('MyOS/Subscribe to Session Requested');

    const permissionRequest = processed.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find(
        (event) =>
          event.type === 'MyOS/Single Document Permission Grant Requested',
      );
    expect(permissionRequest).toMatchObject({
      grantSessionSubscriptionOnResult: true,
      permissions: {
        read: true,
        write: true,
      },
    });

    const subscriptionRequest = processed.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find((event) => event.type === 'MyOS/Subscribe to Session Requested');
    expect(subscriptionRequest).toMatchObject({
      subscription: {
        id: 'SUB_ACCESS',
        events: [{ type: 'Conversation/Response' }],
      },
    });
  });

  it('emits linked and agency permission requests through helper namespaces', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Linked Agency Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .requestId('REQ_AGENCY')
      .done()
      .operation(
        'bootstrapAgency',
        'ownerChannel',
        Number,
        'bootstrap linked and agency',
        (steps) =>
          steps
            .accessLinked('linkedAccess')
            .requestPermission({ anchorA: { read: true } })
            .accessLinked('linkedAccess')
            .subscribe('Conversation/Event')
            .accessLinked('linkedAccess')
            .call('syncState', {
              type: 'Conversation/Event',
            })
            .viaAgency('workerAgency')
            .requestPermission({
              type: 'MyOS/Worker Agency Permission',
              workerType: 'MyOS/MyOS Admin Base',
              permissions: {
                read: true,
              },
            }),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'access linked agency initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'bootstrapAgency',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'access linked agency bootstrap operation failed',
    );
    const eventTypes = processed.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(eventTypes).toContain(
      'MyOS/Linked Documents Permission Grant Requested',
    );
    expect(eventTypes).toContain('MyOS/Subscribe to Session Requested');
    expect(eventTypes).toContain('MyOS/Call Operation Requested');
    expect(eventTypes).toContain(
      'MyOS/Worker Agency Permission Grant Requested',
    );
  });

  it('emits start worker session requests with bindings and options', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Agency Worker Start Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .requestId('REQ_AGENCY')
      .done()
      .operation(
        'startWorker',
        'ownerChannel',
        Number,
        'start worker session',
        (steps) =>
          steps.viaAgency('workerAgency').startWorkerSessionWith(
            'ownerChannel',
            {
              name: 'Child Worker',
              type: 'MyOS/MyOS Admin Base',
            },
            (bindings) =>
              bindings.bind('ownerChannel', {
                accountId: 'acc-owner',
              }),
            (options) =>
              options
                .bootstrapAssignee('myOsAdminChannel')
                .defaultMessage('Worker start'),
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'agency worker start initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'startWorker',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'agency worker start operation failed',
    );

    const startEvent = processed.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find((event) => event.type === 'MyOS/Start Worker Session Requested');
    expect(startEvent).toBeDefined();
    expect(startEvent).toMatchObject({
      channelBindings: {
        ownerChannel: {
          accountId: 'acc-owner',
        },
      },
      options: {
        bootstrapAssignee: 'myOsAdminChannel',
        initialMessages: {
          defaultMessage: 'Worker start',
        },
      },
    });
  });
});
