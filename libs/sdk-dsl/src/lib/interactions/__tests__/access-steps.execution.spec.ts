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

  it('emits revoke requests through access, linked access, and agency helpers', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Interaction Revoke Runtime')
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
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .requestId('REQ_AGENCY')
      .targetSessionId('target-session')
      .done()
      .operation(
        'revokeAll',
        'ownerChannel',
        Number,
        'revoke all integration permissions',
        (steps) =>
          steps
            .access('counterAccess')
            .revokePermission()
            .accessLinked('linkedAccess')
            .revokePermission()
            .viaAgency('workerAgency')
            .revokePermission(),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'interaction revoke initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'revokeAll',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'interaction revoke operation failed',
    );

    const events = processed.triggeredEvents.map((event) =>
      toOfficialJson(event),
    );
    const eventTypes = events.map((event) => event.type as string);
    expect(eventTypes).toContain(
      'MyOS/Single Document Permission Revoke Requested',
    );
    expect(eventTypes).toContain(
      'MyOS/Linked Documents Permission Revoke Requested',
    );
    expect(eventTypes).toContain(
      'MyOS/Worker Agency Permission Revoke Requested',
    );

    const accessRevoke = events.find(
      (event) =>
        event.type === 'MyOS/Single Document Permission Revoke Requested',
    );
    expect(accessRevoke).toMatchObject({
      requestId: 'REQ_ACCESS',
      targetSessionId: 'target-session',
    });

    const linkedRevoke = events.find(
      (event) =>
        event.type === 'MyOS/Linked Documents Permission Revoke Requested',
    );
    expect(linkedRevoke).toMatchObject({
      requestId: 'REQ_LINKED',
      targetSessionId: 'target-session',
    });

    const agencyRevoke = events.find(
      (event) =>
        event.type === 'MyOS/Worker Agency Permission Revoke Requested',
    );
    expect(agencyRevoke).toMatchObject({
      requestId: 'REQ_AGENCY',
      targetSessionId: 'target-session',
    });
  });

  it('emits call and subscription requests through agency helper namespace', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Agency Call Subscribe Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .requestId('REQ_AGENCY')
      .targetSessionId('target-session')
      .done()
      .operation(
        'syncAgency',
        'ownerChannel',
        Number,
        'sync agency session',
        (steps) =>
          steps
            .viaAgency('workerAgency')
            .subscribe('SUB_AGENCY', 'Conversation/Response')
            .viaAgency('workerAgency')
            .call('syncState', {
              type: 'Conversation/Event',
              payload: {
                source: 'runtime',
              },
            }),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'agency call/subscribe initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'syncAgency',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'agency call/subscribe operation failed',
    );

    const events = processed.triggeredEvents.map((event) =>
      toOfficialJson(event),
    );
    const eventTypes = events.map((event) => event.type as string);
    expect(eventTypes).toContain('MyOS/Subscribe to Session Requested');
    expect(eventTypes).toContain('MyOS/Call Operation Requested');

    const subscribeRequest = events.find(
      (event) => event.type === 'MyOS/Subscribe to Session Requested',
    );
    expect(subscribeRequest).toMatchObject({
      targetSessionId: 'target-session',
      subscription: {
        id: 'SUB_AGENCY',
        events: [{ type: 'Conversation/Response' }],
      },
    });

    const callRequest = events.find(
      (event) => event.type === 'MyOS/Call Operation Requested',
    );
    expect(callRequest).toMatchObject({
      targetSessionId: 'target-session',
      operation: 'syncState',
      request: {
        type: 'Conversation/Event',
        payload: {
          source: 'runtime',
        },
      },
    });
  });

  it('handles linked subscription updates through onLinkedUpdate listener helper', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Linked Update Runtime')
      .field('/linkedStatus', 'pending')
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
      .operation(
        'emitLinkedUpdate',
        'ownerChannel',
        Number,
        'emit linked subscription update',
        (steps) =>
          steps.emitType(
            'EmitLinkedSubscriptionUpdate',
            'MyOS/Subscription Update',
            (payload) => {
              payload.put('subscriptionId', 'SUB_LINKED');
              payload.put('update', {
                type: 'Conversation/Response',
                payload: {
                  source: 'runtime',
                },
              });
            },
          ),
      )
      .onLinkedUpdate(
        'linkedAccess',
        'markLinkedUpdate',
        'Conversation/Response',
        (steps) =>
          steps.replaceValue('SetLinkedUpdated', '/linkedStatus', 'updated'),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'linked update listener initialization failed',
    );

    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'emitLinkedUpdate',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });

    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'linked subscription update processing failed',
    );

    const triggeredTypes = processed.triggeredEvents.map(
      (event) => toOfficialJson(event).type as string,
    );
    expect(triggeredTypes).toContain('MyOS/Subscription Update');
    expect(toOfficialJson(processed.document).linkedStatus).toBe('updated');
  });

  it('emits agency helper requests with explicit target override', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Agency Override Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .requestId('REQ_AGENCY')
      .targetSessionId('default-target')
      .done()
      .operation(
        'syncAgencyOverride',
        'ownerChannel',
        Number,
        'sync agency with override',
        (steps) =>
          steps
            .viaAgency('workerAgency')
            .subscribeForTarget(
              'override-target',
              'SUB_AGENCY_OVERRIDE',
              'Conversation/Response',
            )
            .viaAgency('workerAgency')
            .callOnTarget('override-target', 'syncOverride', {
              type: 'Conversation/Event',
              payload: {
                source: 'runtime',
              },
            }),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'agency override initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'syncAgencyOverride',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'agency override operation failed',
    );

    const events = processed.triggeredEvents.map((event) =>
      toOfficialJson(event),
    );
    const subscribeRequest = events.find(
      (event) => event.type === 'MyOS/Subscribe to Session Requested',
    );
    expect(subscribeRequest).toMatchObject({
      targetSessionId: 'override-target',
      subscription: {
        id: 'SUB_AGENCY_OVERRIDE',
      },
    });

    const callRequest = events.find(
      (event) => event.type === 'MyOS/Call Operation Requested',
    );
    expect(callRequest).toMatchObject({
      targetSessionId: 'override-target',
      operation: 'syncOverride',
    });
  });

  it('reacts to interaction lifecycle events through listener helpers', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Interaction Listener Runtime Matrix')
      .field('/accessRejected', false)
      .field('/linkedRevoked', false)
      .field('/agencyRejected', false)
      .field('/sessionState', 'idle')
      .field('/participantsReady', false)
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
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .requestId('REQ_AGENCY')
      .targetSessionId('target-session')
      .done()
      .onAccessRejected('counterAccess', 'markAccessRejected', (steps) =>
        steps.replaceValue('SetAccessRejected', '/accessRejected', true),
      )
      .onLinkedAccessRevoked('linkedAccess', 'markLinkedRevoked', (steps) =>
        steps.replaceValue('SetLinkedRevoked', '/linkedRevoked', true),
      )
      .onAgencyRejected('workerAgency', 'markAgencyRejected', (steps) =>
        steps.replaceValue('SetAgencyRejected', '/agencyRejected', true),
      )
      .onSessionStarting('workerAgency', 'markSessionStarting', (steps) =>
        steps.replaceValue('SetSessionStarting', '/sessionState', 'starting'),
      )
      .onAllParticipantsReady('markAllParticipantsReady', (steps) =>
        steps.replaceValue('SetParticipantsReady', '/participantsReady', true),
      )
      .operation(
        'emitLifecycleEvents',
        'ownerChannel',
        Number,
        'emit lifecycle events for listeners',
        (steps) =>
          steps
            .emitType(
              'EmitAccessRejected',
              'MyOS/Single Document Permission Rejected',
              (payload) => {
                payload.put('requestId', 'REQ_ACCESS');
                payload.put('inResponseTo', {
                  requestId: 'REQ_ACCESS',
                });
              },
            )
            .emitType(
              'EmitLinkedRevoked',
              'MyOS/Linked Documents Permission Revoked',
              (payload) => {
                payload.put('requestId', 'REQ_LINKED');
                payload.put('inResponseTo', {
                  requestId: 'REQ_LINKED',
                });
              },
            )
            .emitType(
              'EmitAgencyRejected',
              'MyOS/Worker Agency Permission Rejected',
              (payload) => {
                payload.put('requestId', 'REQ_AGENCY');
                payload.put('inResponseTo', {
                  requestId: 'REQ_AGENCY',
                });
              },
            )
            .emitType('EmitSessionStarting', 'MyOS/Worker Session Starting')
            .emitType(
              'EmitAllParticipantsReady',
              'MyOS/All Participants Ready',
            ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'interaction listener runtime initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'emitLifecycleEvents',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'interaction listener runtime operation failed',
    );

    const processedJson = toOfficialJson(processed.document);
    expect(processedJson.accessRejected).toBe(true);
    expect(processedJson.linkedRevoked).toBe(true);
    expect(processedJson.agencyRejected).toBe(true);
    expect(processedJson.sessionState).toBe('starting');
    expect(processedJson.participantsReady).toBe(true);
  });

  it('handles agency subscription updates through onAgencyUpdate listener helper', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Agency Update Runtime')
      .field('/agencyStatus', 'idle')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .requestId('REQ_AGENCY')
      .targetSessionId('target-session')
      .done()
      .onAgencyUpdate(
        'workerAgency',
        'markAgencyUpdate',
        'SUB_AGENCY',
        'Conversation/Response',
        (steps) =>
          steps.replaceValue('SetAgencyUpdated', '/agencyStatus', 'updated'),
      )
      .operation(
        'emitAgencyUpdate',
        'ownerChannel',
        Number,
        'emit agency subscription update',
        (steps) =>
          steps.emitType(
            'EmitAgencySubscriptionUpdate',
            'MyOS/Subscription Update',
            (payload) => {
              payload.put('subscriptionId', 'SUB_AGENCY');
              payload.put('update', {
                type: 'Conversation/Response',
                payload: {
                  source: 'runtime',
                },
              });
            },
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'agency update listener initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'emitAgencyUpdate',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'agency update listener operation failed',
    );

    expect(toOfficialJson(processed.document).agencyStatus).toBe('updated');
  });
});
