import { BlueNode } from '@blue-labs/language';
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
import type { JsonObject } from '../../core/types.js';

function expectReadPermissionEnabled(
  permissions: Record<string, unknown> | undefined,
): void {
  expect(permissions?.read === true || permissions?.read === undefined).toBe(
    true,
  );
}

type CallResponseEvent = JsonObject;

function createCallResponseBaseDocument(name: string): DocBuilder {
  return DocBuilder.doc()
    .name(name)
    .field('/handled', false)
    .field('/approvedHandled', false)
    .field('/capturedHandled', false)
    .field('/matchCount', 0)
    .field('/lastAmountCaptured', 0)
    .field('/responseCount', 0)
    .field('/lastTargetSessionId', '')
    .channel('ownerChannel', {
      type: 'Conversation/Timeline Channel',
      timelineId: 'owner-timeline',
    })
    .access('counterAccess')
    .permissionFrom('ownerChannel')
    .targetSessionId('target-session')
    .requestId('REQ_CALL')
    .done();
}

function withCallResponseEnvelopeOperation(
  document: DocBuilder,
  events: CallResponseEvent[],
  operation = 'emitCallEnvelope',
  requestId = 'REQ_CALL',
): DocBuilder {
  return document.operation(
    operation,
    'ownerChannel',
    Number,
    'emit call response envelope',
    (steps) =>
      steps.emitType(
        'EmitCallEnvelope',
        'MyOS/Call Operation Responded',
        (payload) => {
          payload.put('targetSessionId', 'target-session');
          payload.put('inResponseTo', {
            requestId,
          });
          payload.put('events', events);
        },
      ),
  );
}

async function processCallResponseOperation(
  document: BlueNode,
  operation = 'emitCallEnvelope',
): Promise<Record<string, unknown>> {
  const blue = createTestBlue();
  const processor = createTestDocumentProcessor(blue);
  const initialized = await expectSuccess(
    processor.initializeDocument(document),
    'call response initialization failed',
  );
  const documentBlueId = storedDocumentBlueId(initialized.document);
  const processed = await expectSuccess(
    processor.processDocument(
      initialized.document.clone(),
      operationRequestEvent(blue, {
        operation,
        request: 1,
        timelineId: 'owner-timeline',
        documentBlueId,
        allowNewerVersion: false,
      }),
    ),
    'call response operation failed',
  );
  return toOfficialJson(processed.document);
}

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
      .subscriptionEvents('Conversation/Response')
      .done()
      .operation(
        'bootstrapAccess',
        'ownerChannel',
        Number,
        'bootstrap access',
        (steps) =>
          steps
            .access('counterAccess')
            .requestPermission({
              read: true,
              share: true,
            })
            .access('counterAccess')
            .subscribe(),
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
    expect(permissionRequest).toBeDefined();
    const permissionSet = permissionRequest?.permissions as
      | Record<string, unknown>
      | undefined;
    expect(permissionSet).toMatchObject({
      share: true,
    });
    expectReadPermissionEnabled(permissionSet);
    expect(permissionRequest).not.toHaveProperty(
      'grantSessionSubscriptionOnResult',
    );

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

  it('defaults access grants to read permission', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Default Read Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .operations('search')
      .done()
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'access default-read initialization failed',
    );

    const permissionRequest = initialized.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find(
        (event) =>
          event.type === 'MyOS/Single Document Permission Grant Requested',
      );
    expect(permissionRequest).toMatchObject({
      permissions: {
        read: true,
        singleOps: ['search'],
      },
    });
  });

  it('marks access subscribed from a direct subscription initiated event', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Subscription Ready Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_ACCESS')
      .subscriptionId('SUB_ACCESS')
      .statusPath('/subscriptionState')
      .subscribeAfterGranted()
      .subscriptionEvents('MyOS/Session Epoch Advanced')
      .done()
      .operation(
        'emitLifecycle',
        'ownerChannel',
        Number,
        'emit access grant and subscription initiation',
        (steps) =>
          steps
            .emitType(
              'EmitAccessGranted',
              'MyOS/Single Document Permission Granted',
              (payload) => {
                payload.put('inResponseTo', {
                  requestId: 'REQ_ACCESS',
                });
              },
            )
            .emitType(
              'EmitSubscriptionInitiated',
              'MyOS/Subscription to Session Initiated',
              (payload) => {
                payload.put('subscriptionId', 'SUB_ACCESS');
                payload.put('targetSessionId', 'target-session');
                payload.put('epoch', 0);
                payload.put('document', {
                  name: 'Target Session',
                });
              },
            ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'access subscription-ready initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'emitLifecycle',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'access subscription-ready operation failed',
    );

    expect(toOfficialJson(processed.document).subscriptionState).toBe(
      'subscribed',
    );
  });

  it('emits wildcard subscription requests after access grants when no filters are configured', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Wildcard Subscription Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_ACCESS')
      .subscriptionId('SUB_ACCESS')
      .subscribeAfterGranted()
      .done()
      .operation(
        'emitGranted',
        'ownerChannel',
        Number,
        'emit access grant',
        (steps) =>
          steps.emitType(
            'EmitAccessGranted',
            'MyOS/Single Document Permission Granted',
            (payload) => {
              payload.put('inResponseTo', {
                requestId: 'REQ_ACCESS',
              });
            },
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'access wildcard initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'emitGranted',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'access wildcard operation failed',
    );

    const subscribeRequest = processed.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find((event) => event.type === 'MyOS/Subscribe to Session Requested');

    expect(subscribeRequest).toMatchObject({
      targetSessionId: 'target-session',
      subscription: {
        id: 'SUB_ACCESS',
      },
    });
    expect(subscribeRequest?.subscription).not.toHaveProperty('events');
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
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
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
            .subscribe()
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

    const workerAgencyRequest = processed.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find(
        (event) =>
          event.type === 'MyOS/Worker Agency Permission Grant Requested',
      );
    expect(workerAgencyRequest).toMatchObject({
      allowedWorkerAgencyPermissions: [
        {
          type: 'MyOS/Worker Agency Permission',
          workerType: 'MyOS/MyOS Admin Base',
          permissions: {
            read: true,
          },
        },
      ],
    });
    expect(workerAgencyRequest).not.toHaveProperty('workerAgencyPermissions');
  });

  it('defaults linked-access grants to read permission', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Linked Access Default Read Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .link('anchorA')
      .operations('syncState')
      .done()
      .done()
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'linked-access default-read initialization failed',
    );

    const permissionRequest = initialized.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find(
        (event) =>
          event.type === 'MyOS/Linked Documents Permission Grant Requested',
      );
    expect(permissionRequest).toMatchObject({
      links: {
        anchorA: {
          read: true,
          singleOps: ['syncState'],
        },
      },
    });
  });

  it('emits runtime-shaped worker agency permission requests on init', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Agency Init Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .allowedOperations('proposeOffer', 'accept')
      .done()
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'agency init initialization failed',
    );

    const workerAgencyRequest = initialized.triggeredEvents
      .map((event) => toOfficialJson(event))
      .find(
        (event) =>
          event.type === 'MyOS/Worker Agency Permission Grant Requested',
      );
    expect(workerAgencyRequest).toMatchObject({
      onBehalfOf: 'ownerChannel',
      requestId: 'REQ_AGENCY_WORKERAGENCY',
      allowedWorkerAgencyPermissions: [
        {
          type: 'MyOS/Worker Agency Permission',
          workerType: 'MyOS/MyOS Admin Base',
          permissions: {
            read: true,
            singleOps: ['proposeOffer', 'accept'],
          },
        },
      ],
    });
    expect(workerAgencyRequest).not.toHaveProperty('workerAgencyPermissions');
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
      .allowedTypes('MyOS/MyOS Admin Base')
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
                .defaultMessage('Worker start')
                .capabilities((capabilities) =>
                  capabilities.participantsOrchestration(true),
                ),
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
      onBehalfOf: 'ownerChannel',
      channelBindings: {
        ownerChannel: {
          accountId: 'acc-owner',
        },
      },
      initialMessages: {
        defaultMessage: 'Worker start',
      },
      capabilities: {
        participantsOrchestration: true,
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
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
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
      .allowedTypes('MyOS/MyOS Admin Base')
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
      requestId: 'REQ_AGENCY',
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
      .link('anchorA')
      .read(true)
      .done()
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
      .allowedTypes('MyOS/MyOS Admin Base')
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
      requestId: 'REQ_AGENCY',
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
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
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
            .emitType(
              'EmitSessionStarting',
              'MyOS/Worker Session Starting',
              (payload) => {
                payload.put('inResponseTo', {
                  requestId: 'REQ_AGENCY',
                });
              },
            )
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

  it('ignores unrelated worker session starting events for agency listeners', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Agency Session Starting Correlation Runtime')
      .field('/sessionState', 'pending')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .done()
      .onSessionStarting('workerAgency', 'markSessionStarting', (steps) =>
        steps.replaceValue('SetSessionStarting', '/sessionState', 'starting'),
      )
      .operation(
        'emitUnrelatedSessionStarting',
        'ownerChannel',
        Number,
        'emit unrelated worker session starting',
        (steps) =>
          steps.emitType(
            'EmitSessionStarting',
            'MyOS/Worker Session Starting',
            (payload) => {
              payload.put('inResponseTo', {
                requestId: 'REQ_OTHER',
              });
            },
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'agency session-starting correlation initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'emitUnrelatedSessionStarting',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'agency session-starting correlation operation failed',
    );

    expect(toOfficialJson(processed.document).sessionState).toBe('pending');
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
      .allowedTypes('MyOS/MyOS Admin Base')
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

  it('reacts to additional interaction listener helper events at runtime', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Interaction Listener Runtime Extras')
      .field('/accessGranted', false)
      .field('/callResponded', false)
      .field('/sessionCreated', false)
      .field('/accessRevoked', false)
      .field('/linkedAccessGranted', false)
      .field('/linkedAccessRejected', false)
      .field('/linkedAccessRevoked', false)
      .field('/linkedDocGranted', false)
      .field('/linkedDocRejected', false)
      .field('/linkedDocRevoked', false)
      .field('/agencyGranted', false)
      .field('/agencyRevoked', false)
      .field('/sessionStarted', false)
      .field('/sessionFailed', false)
      .field('/participantResolved', false)
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
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .targetSessionId('target-session')
      .done()
      .onAccessGranted('counterAccess', 'markAccessGranted', (steps) =>
        steps.replaceValue('SetAccessGranted', '/accessGranted', true),
      )
      .onCallResponse('counterAccess', 'markCallResponded', (steps) =>
        steps.replaceValue('SetCallResponded', '/callResponded', true),
      )
      .onSessionCreated('counterAccess', 'markSessionCreated', (steps) =>
        steps.replaceValue('SetSessionCreated', '/sessionCreated', true),
      )
      .onAccessRevoked('counterAccess', 'markAccessRevoked', (steps) =>
        steps.replaceValue('SetAccessRevoked', '/accessRevoked', true),
      )
      .onLinkedAccessGranted(
        'linkedAccess',
        'markLinkedAccessGranted',
        (steps) =>
          steps.replaceValue(
            'SetLinkedAccessGranted',
            '/linkedAccessGranted',
            true,
          ),
      )
      .onLinkedAccessRejected(
        'linkedAccess',
        'markLinkedAccessRejected',
        (steps) =>
          steps.replaceValue(
            'SetLinkedAccessRejected',
            '/linkedAccessRejected',
            true,
          ),
      )
      .onLinkedAccessRevoked(
        'linkedAccess',
        'markLinkedAccessRevoked',
        (steps) =>
          steps.replaceValue(
            'SetLinkedAccessRevoked',
            '/linkedAccessRevoked',
            true,
          ),
      )
      .onLinkedDocGranted('linkedAccess', 'markLinkedDocGranted', (steps) =>
        steps.replaceValue('SetLinkedDocGranted', '/linkedDocGranted', true),
      )
      .onLinkedDocRevoked('linkedAccess', 'markLinkedDocRevoked', (steps) =>
        steps.replaceValue('SetLinkedDocRevoked', '/linkedDocRevoked', true),
      )
      .onAgencyGranted('workerAgency', 'markAgencyGranted', (steps) =>
        steps.replaceValue('SetAgencyGranted', '/agencyGranted', true),
      )
      .onAgencyRevoked('workerAgency', 'markAgencyRevoked', (steps) =>
        steps.replaceValue('SetAgencyRevoked', '/agencyRevoked', true),
      )
      .onSessionStarted('workerAgency', 'markSessionStarted', (steps) =>
        steps.replaceValue('SetSessionStarted', '/sessionStarted', true),
      )
      .onSessionFailed('workerAgency', 'markSessionFailed', (steps) =>
        steps.replaceValue('SetSessionFailed', '/sessionFailed', true),
      )
      .onParticipantResolved('markParticipantResolved', (steps) =>
        steps.replaceValue(
          'SetParticipantResolved',
          '/participantResolved',
          true,
        ),
      )
      .operation(
        'emitExtraListenerEvents',
        'ownerChannel',
        Number,
        'emit extra interaction listener events',
        (steps) =>
          steps
            .emitType(
              'EmitAccessGranted',
              'MyOS/Single Document Permission Granted',
              (payload) => {
                payload.put('requestId', 'REQ_ACCESS');
                payload.put('inResponseTo', {
                  requestId: 'REQ_ACCESS',
                });
              },
            )
            .emitType(
              'EmitCallResponse',
              'MyOS/Call Operation Responded',
              (payload) => {
                payload.put('inResponseTo', {
                  requestId: 'REQ_ACCESS',
                });
                payload.put('response', {
                  type: 'Conversation/Response',
                });
              },
            )
            .emitType(
              'EmitSessionCreated',
              'MyOS/Subscription to Session Initiated',
              (payload) => {
                payload.put('subscriptionId', 'SUB_ACCESS');
                payload.put('targetSessionId', 'target-session');
                payload.put('epoch', 0);
                payload.put('document', {
                  name: 'Target Session',
                });
              },
            )
            .emitType(
              'EmitLinkedDocGranted',
              'MyOS/Single Document Permission Granted',
              (payload) => {
                payload.put('inResponseTo', {
                  requestId: 'REQ_LINKED',
                });
              },
            )
            .emitType(
              'EmitAccessRevoked',
              'MyOS/Single Document Permission Revoked',
              (payload) => {
                payload.put('requestId', 'REQ_ACCESS');
                payload.put('inResponseTo', {
                  requestId: 'REQ_ACCESS',
                });
              },
            )
            .emitType(
              'EmitLinkedAccessGranted',
              'MyOS/Linked Documents Permission Granted',
              (payload) => {
                payload.put('requestId', 'REQ_LINKED');
                payload.put('inResponseTo', {
                  requestId: 'REQ_LINKED',
                });
              },
            )
            .emitType(
              'EmitLinkedAccessRejected',
              'MyOS/Linked Documents Permission Rejected',
              (payload) => {
                payload.put('requestId', 'REQ_LINKED');
                payload.put('inResponseTo', {
                  requestId: 'REQ_LINKED',
                });
              },
            )
            .emitType(
              'EmitLinkedAccessRevoked',
              'MyOS/Linked Documents Permission Revoked',
              (payload) => {
                payload.put('requestId', 'REQ_LINKED');
                payload.put('inResponseTo', {
                  requestId: 'REQ_LINKED',
                });
              },
            )
            .emitType(
              'EmitLinkedDocRevoked',
              'MyOS/Single Document Permission Revoked',
              (payload) => {
                payload.put('inResponseTo', {
                  requestId: 'REQ_LINKED',
                });
              },
            )
            .emitType(
              'EmitAgencyGranted',
              'MyOS/Worker Agency Permission Granted',
              (payload) => {
                payload.put('requestId', 'REQ_AGENCY');
                payload.put('inResponseTo', {
                  requestId: 'REQ_AGENCY',
                });
              },
            )
            .emitType(
              'EmitSessionStarted',
              'MyOS/Target Document Session Started',
            )
            .emitType(
              'EmitAgencyRevoked',
              'MyOS/Worker Agency Permission Revoked',
              (payload) => {
                payload.put('requestId', 'REQ_AGENCY');
                payload.put('inResponseTo', {
                  requestId: 'REQ_AGENCY',
                });
              },
            )
            .emitType('EmitSessionFailed', 'MyOS/Bootstrap Failed')
            .emitType('EmitParticipantResolved', 'MyOS/Participant Resolved'),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'interaction listener extras initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'emitExtraListenerEvents',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'interaction listener extras operation failed',
    );

    const processedJson = toOfficialJson(processed.document);
    expect(processedJson.accessGranted).toBe(true);
    expect(processedJson.callResponded).toBe(true);
    expect(processedJson.sessionCreated).toBe(true);
    expect(processedJson.accessRevoked).toBe(true);
    expect(processedJson.linkedAccessGranted).toBe(true);
    expect(processedJson.linkedAccessRejected).toBe(true);
    expect(processedJson.linkedAccessRevoked).toBe(true);
    expect(processedJson.linkedDocGranted).toBe(true);
    expect(processedJson.linkedDocRevoked).toBe(true);
    expect(processedJson.agencyGranted).toBe(true);
    expect(processedJson.agencyRevoked).toBe(true);
    expect(processedJson.sessionStarted).toBe(true);
    expect(processedJson.sessionFailed).toBe(true);
    expect(processedJson.participantResolved).toBe(true);
  }, 15_000);

  it('correlates onSessionCreated listeners to the configured access subscriptionId', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Session Created Correlation Runtime')
      .field('/counterSessionCreated', false)
      .field('/otherSessionCreated', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('counter-target')
      .requestId('REQ_COUNTER')
      .subscriptionId('SUB_COUNTER')
      .done()
      .access('otherAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('other-target')
      .requestId('REQ_OTHER')
      .subscriptionId('SUB_OTHER')
      .done()
      .onSessionCreated('counterAccess', 'markCounterSessionCreated', (steps) =>
        steps.replaceValue(
          'SetCounterSessionCreated',
          '/counterSessionCreated',
          true,
        ),
      )
      .onSessionCreated('otherAccess', 'markOtherSessionCreated', (steps) =>
        steps.replaceValue(
          'SetOtherSessionCreated',
          '/otherSessionCreated',
          true,
        ),
      )
      .operation(
        'emitOtherSessionCreated',
        'ownerChannel',
        Number,
        'emit session created for other access only',
        (steps) =>
          steps.emitType(
            'EmitSessionCreated',
            'MyOS/Subscription to Session Initiated',
            (payload) => {
              payload.put('subscriptionId', 'SUB_OTHER');
              payload.put('targetSessionId', 'other-target');
              payload.put('epoch', 0);
              payload.put('document', {
                name: 'Other Target Session',
              });
            },
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'session created correlation initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const processed = await expectSuccess(
      processor.processDocument(
        initialized.document.clone(),
        operationRequestEvent(blue, {
          operation: 'emitOtherSessionCreated',
          request: 1,
          timelineId: 'owner-timeline',
          documentBlueId,
          allowNewerVersion: false,
        }),
      ),
      'session created correlation operation failed',
    );

    expect(toOfficialJson(processed.document)).toMatchObject({
      counterSessionCreated: false,
      otherSessionCreated: true,
    });
  });

  it('emits access and linked-access helper requests with explicit target overrides', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Override Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('default-access-target')
      .requestId('REQ_ACCESS')
      .subscriptionId('SUB_ACCESS')
      .done()
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('default-linked-target')
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .operation(
        'syncOverrides',
        'ownerChannel',
        Number,
        'sync override targets',
        (steps) =>
          steps
            .access('counterAccess')
            .subscribeForTarget(
              'override-access-target',
              'SUB_ACCESS_OVERRIDE',
              'Conversation/Response',
            )
            .access('counterAccess')
            .callOnTarget('override-access-target', 'syncAccess', {
              type: 'Conversation/Event',
            })
            .accessLinked('linkedAccess')
            .subscribeForTarget(
              'override-linked-target',
              'SUB_LINKED_OVERRIDE',
              'Conversation/Event',
            )
            .accessLinked('linkedAccess')
            .callOnTarget('override-linked-target', 'syncLinked', {
              type: 'Conversation/Event',
            }),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'access override initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'syncOverrides',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'access override operation failed',
    );

    const events = processed.triggeredEvents.map((event) =>
      toOfficialJson(event),
    );
    const subscribeRequests = events.filter(
      (event) => event.type === 'MyOS/Subscribe to Session Requested',
    );
    expect(subscribeRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetSessionId: 'override-access-target',
          subscription: expect.objectContaining({
            id: 'SUB_ACCESS_OVERRIDE',
          }),
        }),
        expect.objectContaining({
          targetSessionId: 'override-linked-target',
          subscription: expect.objectContaining({
            id: 'SUB_LINKED_OVERRIDE',
          }),
        }),
      ]),
    );

    const callRequests = events.filter(
      (event) => event.type === 'MyOS/Call Operation Requested',
    );
    expect(callRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetSessionId: 'override-access-target',
          requestId: 'REQ_ACCESS',
          operation: 'syncAccess',
        }),
        expect.objectContaining({
          targetSessionId: 'override-linked-target',
          requestId: 'REQ_LINKED',
          operation: 'syncLinked',
        }),
      ]),
    );
  });

  it('emits permission and revoke requests with explicit target overrides', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Access Permission Override Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('default-access-target')
      .requestId('REQ_ACCESS')
      .subscriptionId('SUB_ACCESS')
      .done()
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('default-linked-target')
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .subscriptionId('SUB_LINKED')
      .done()
      .operation(
        'overridePermissions',
        'ownerChannel',
        Number,
        'override permission targets',
        (steps) =>
          steps
            .access('counterAccess')
            .requestPermissionForTarget('override-access-target', {
              read: true,
              share: true,
            })
            .access('counterAccess')
            .revokePermissionForTarget('override-access-target')
            .accessLinked('linkedAccess')
            .requestPermissionForTarget('override-linked-target', {
              anchorA: { read: true },
            })
            .accessLinked('linkedAccess')
            .revokePermissionForTarget('override-linked-target'),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'access permission override initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'overridePermissions',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'access permission override operation failed',
    );

    const events = processed.triggeredEvents.map((event) =>
      toOfficialJson(event),
    );
    const accessGrant = events.find(
      (event) =>
        event.type === 'MyOS/Single Document Permission Grant Requested' &&
        event.targetSessionId === 'override-access-target',
    );
    expect(accessGrant).toBeDefined();
    const accessGrantPermissions = accessGrant?.permissions as
      | Record<string, unknown>
      | undefined;
    expect(accessGrantPermissions).toMatchObject({
      share: true,
    });
    expectReadPermissionEnabled(accessGrantPermissions);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MyOS/Single Document Permission Grant Requested',
          targetSessionId: 'override-access-target',
        }),
        expect.objectContaining({
          type: 'MyOS/Single Document Permission Revoke Requested',
          targetSessionId: 'override-access-target',
        }),
        expect.objectContaining({
          type: 'MyOS/Linked Documents Permission Grant Requested',
          targetSessionId: 'override-linked-target',
        }),
        expect.objectContaining({
          type: 'MyOS/Linked Documents Permission Revoke Requested',
          targetSessionId: 'override-linked-target',
        }),
      ]),
    );
  });

  it('emits agency permission and revoke requests with explicit target override', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Agency Permission Override Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .targetSessionId('default-target')
      .done()
      .operation(
        'overrideAgencyPermissions',
        'ownerChannel',
        Number,
        'override agency permission target',
        (steps) =>
          steps
            .viaAgency('workerAgency')
            .requestPermission(
              {
                type: 'MyOS/Worker Agency Permission',
                workerType: 'MyOS/MyOS Admin Base',
                permissions: {
                  read: true,
                },
              },
              'override-target',
            )
            .viaAgency('workerAgency')
            .revokePermission('override-target'),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'agency permission override initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'overrideAgencyPermissions',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'agency permission override operation failed',
    );

    const events = processed.triggeredEvents.map((event) =>
      toOfficialJson(event),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MyOS/Worker Agency Permission Grant Requested',
          targetSessionId: 'override-target',
          allowedWorkerAgencyPermissions: [
            {
              type: 'MyOS/Worker Agency Permission',
              workerType: 'MyOS/MyOS Admin Base',
              permissions: {
                read: true,
              },
            },
          ],
        }),
        expect.objectContaining({
          type: 'MyOS/Worker Agency Permission Revoke Requested',
          targetSessionId: 'override-target',
        }),
      ]),
    );
  });

  it('emits agency explicit helper variant requests for target override', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Agency Explicit Permission Override Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .agency('workerAgency')
      .permissionFrom('ownerChannel')
      .allowedTypes('MyOS/MyOS Admin Base')
      .requestId('REQ_AGENCY')
      .targetSessionId('default-target')
      .done()
      .operation(
        'overrideAgencyPermissionsExplicit',
        'ownerChannel',
        Number,
        'override agency permission explicit helpers',
        (steps) =>
          steps
            .viaAgency('workerAgency')
            .requestPermissionForTarget('explicit-target', {
              type: 'MyOS/Worker Agency Permission',
              workerType: 'MyOS/MyOS Admin Base',
              permissions: {
                read: true,
              },
            })
            .viaAgency('workerAgency')
            .revokePermissionForTarget('explicit-target'),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'agency explicit permission override initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'overrideAgencyPermissionsExplicit',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'agency explicit permission override operation failed',
    );

    const events = processed.triggeredEvents.map((event) =>
      toOfficialJson(event),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MyOS/Worker Agency Permission Grant Requested',
          targetSessionId: 'explicit-target',
          allowedWorkerAgencyPermissions: [
            {
              type: 'MyOS/Worker Agency Permission',
              workerType: 'MyOS/MyOS Admin Base',
              permissions: {
                read: true,
              },
            },
          ],
        }),
        expect.objectContaining({
          type: 'MyOS/Worker Agency Permission Revoke Requested',
          targetSessionId: 'explicit-target',
        }),
      ]),
    );
  });

  it('matches typed call responses only through MyOS call-response envelopes', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = createCallResponseBaseDocument(
      'Typed Call Response Runtime',
    )
      .onCallResponse(
        'counterAccess',
        'markTypedCallResponse',
        'Conversation/Response',
        (steps) => steps.replaceValue('SetHandled', '/handled', true),
      )
      .operation(
        'emitDirectResponse',
        'ownerChannel',
        Number,
        'emit direct response',
        (steps) =>
          steps.emitType('EmitDirectResponse', 'Conversation/Response'),
      )
      .operation(
        'emitCallEnvelope',
        'ownerChannel',
        Number,
        'emit call response envelope',
        (steps) =>
          steps.emitType(
            'EmitCallEnvelope',
            'MyOS/Call Operation Responded',
            (payload) => {
              payload.put('events', [
                {
                  type: 'Conversation/Response',
                  requestId: 'REQ_CALL',
                  inResponseTo: {
                    requestId: 'REQ_CALL',
                  },
                },
              ]);
            },
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'typed call response initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const directResponseProcessed = await expectSuccess(
      processor.processDocument(
        initialized.document.clone(),
        operationRequestEvent(blue, {
          operation: 'emitDirectResponse',
          request: 1,
          timelineId: 'owner-timeline',
          documentBlueId,
          allowNewerVersion: false,
        }),
      ),
      'direct response operation failed',
    );
    expect(toOfficialJson(directResponseProcessed.document).handled).toBe(
      false,
    );

    const envelopeProcessed = await expectSuccess(
      processor.processDocument(
        initialized.document.clone(),
        operationRequestEvent(blue, {
          operation: 'emitCallEnvelope',
          request: 1,
          timelineId: 'owner-timeline',
          documentBlueId,
          allowNewerVersion: false,
        }),
      ),
      'call envelope operation failed',
    );
    expect(toOfficialJson(envelopeProcessed.document).handled).toBe(true);
  });

  it('keeps untyped onCallResponse bound to the full MyOS call-response envelope', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument(
        'Untyped Call Response Envelope',
      ).onCallResponse('counterAccess', 'captureEnvelope', (steps) =>
        steps
          .replaceExpression(
            'SaveTargetSession',
            '/lastTargetSessionId',
            'event.targetSessionId',
          )
          .replaceExpression(
            'SaveResponseCount',
            '/responseCount',
            'event.events.length',
          ),
      ),
      [
        {
          type: 'PayNote/PayNote Approved',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 42,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.lastTargetSessionId).toBe('target-session');
    expect(processedJson.responseCount).toBe(2);
  });

  it('does not run untyped onCallResponse for a different access requestId', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument('Untyped Call Response Correlation')
        .field('/otherHandled', false)
        .access('otherAccess')
        .permissionFrom('ownerChannel')
        .targetSessionId('other-session')
        .requestId('REQ_OTHER')
        .done()
        .onCallResponse('counterAccess', 'captureCounterEnvelope', (steps) =>
          steps.replaceValue('SetCounterHandled', '/handled', true),
        )
        .onCallResponse('otherAccess', 'captureOtherEnvelope', (steps) =>
          steps.replaceValue('SetOtherHandled', '/otherHandled', true),
        ),
      [
        {
          type: 'Conversation/Response',
          requestId: 'REQ_OTHER',
          inResponseTo: {
            requestId: 'REQ_OTHER',
          },
        },
      ],
      'emitCallEnvelope',
      'REQ_OTHER',
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.handled).toBe(false);
    expect(processedJson.otherHandled).toBe(true);
  });

  it('does not run linked-doc listeners for direct access permission events', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);
    const document = DocBuilder.doc()
      .name('Linked Doc Listener Correlation Runtime')
      .field('/linkedDocGranted', false)
      .field('/linkedDocRevoked', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .access('counterAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .requestId('REQ_ACCESS')
      .done()
      .accessLinked('linkedAccess')
      .permissionFrom('ownerChannel')
      .targetSessionId('target-session')
      .link('anchorA')
      .read(true)
      .done()
      .requestId('REQ_LINKED')
      .done()
      .onLinkedDocGranted('linkedAccess', 'markLinkedDocGranted', (steps) =>
        steps.replaceValue('SetLinkedDocGranted', '/linkedDocGranted', true),
      )
      .onLinkedDocRevoked('linkedAccess', 'markLinkedDocRevoked', (steps) =>
        steps.replaceValue('SetLinkedDocRevoked', '/linkedDocRevoked', true),
      )
      .operation(
        'emitDirectPermissionEvents',
        'ownerChannel',
        Number,
        'emit direct access permission events',
        (steps) =>
          steps
            .emitType(
              'EmitDirectGranted',
              'MyOS/Single Document Permission Granted',
              (payload) => {
                payload.put('inResponseTo', {
                  requestId: 'REQ_ACCESS',
                });
              },
            )
            .emitType(
              'EmitDirectRevoked',
              'MyOS/Single Document Permission Revoked',
              (payload) => {
                payload.put('inResponseTo', {
                  requestId: 'REQ_ACCESS',
                });
              },
            ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'linked doc listener correlation initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);
    const request = operationRequestEvent(blue, {
      operation: 'emitDirectPermissionEvents',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), request),
      'linked doc listener correlation operation failed',
    );

    const processedJson = toOfficialJson(processed.document);
    expect(processedJson.linkedDocGranted).toBe(false);
    expect(processedJson.linkedDocRevoked).toBe(false);
  });

  it('matches exact typed call response when the matching item is second and ignores a nonmatching sibling', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument(
        'Typed Call Response Second Item',
      ).onCallResponse(
        'counterAccess',
        'onCaptured',
        'PayNote/Funds Captured',
        (steps) =>
          steps
            .replaceValue('SetHandled', '/handled', true)
            .replaceExpression(
              'IncrementMatchCount',
              '/matchCount',
              "document('/matchCount') + 1",
            )
            .replaceExpression(
              'SaveCapturedAmount',
              '/lastAmountCaptured',
              'event.amountCaptured',
            ),
      ),
      [
        {
          type: 'PayNote/PayNote Approved',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 42,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.handled).toBe(true);
    expect(processedJson.matchCount).toBe(1);
    expect(processedJson.lastAmountCaptured).toBe(42);
  });

  it('does not match exact typed call response when only nonmatching response types are emitted', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument(
        'Exact Typed Call Response Mismatch',
      ).onCallResponse(
        'counterAccess',
        'onCaptured',
        'PayNote/Funds Captured',
        (steps) =>
          steps
            .replaceValue('SetHandled', '/handled', true)
            .replaceExpression(
              'IncrementMatchCount',
              '/matchCount',
              "document('/matchCount') + 1",
            ),
      ),
      [
        {
          type: 'PayNote/PayNote Approved',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'MyOS/Call Operation Accepted',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.handled).toBe(false);
    expect(processedJson.matchCount).toBe(0);
    expect(processedJson.lastAmountCaptured).toBe(0);
  });

  it('matches base Conversation/Response listener for derived response items regardless of order', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument(
        'Derived Response Type Match',
      ).onCallResponse(
        'counterAccess',
        'onAnyResponse',
        'Conversation/Response',
        (steps) =>
          steps.replaceExpression(
            'IncrementMatchCount',
            '/matchCount',
            "document('/matchCount') + 1",
          ),
      ),
      [
        {
          type: 'PayNote/PayNote Approved',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 42,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.matchCount).toBe(2);
  });

  it('runs two different typed listeners for two different response types from one envelope', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument('Two Typed Call Responses')
        .onCallResponse(
          'counterAccess',
          'onApproved',
          'PayNote/PayNote Approved',
          (steps) =>
            steps.replaceValue('SetApprovedHandled', '/approvedHandled', true),
        )
        .onCallResponse(
          'counterAccess',
          'onCaptured',
          'PayNote/Funds Captured',
          (steps) =>
            steps.replaceValue('SetCapturedHandled', '/capturedHandled', true),
        ),
      [
        {
          type: 'PayNote/PayNote Approved',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 42,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.approvedHandled).toBe(true);
    expect(processedJson.capturedHandled).toBe(true);
  });

  it('does not duplicate inner response fanout when multiple typed listeners share one access request', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument('Shared Call Response Fanout')
        .onCallResponse(
          'counterAccess',
          'countAnyResponse',
          'Conversation/Response',
          (steps) =>
            steps.replaceExpression(
              'IncrementResponseCount',
              '/responseCount',
              "document('/responseCount') + 1",
            ),
        )
        .onCallResponse(
          'counterAccess',
          'onCaptured',
          'PayNote/Funds Captured',
          (steps) =>
            steps.replaceValue('SetCapturedHandled', '/capturedHandled', true),
        ),
      [
        {
          type: 'PayNote/PayNote Approved',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 42,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.responseCount).toBe(2);
    expect(processedJson.capturedHandled).toBe(true);
  });

  it('typed listener receives the matched inner response as event payload', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument(
        'Inner Response Payload Access',
      ).onCallResponse(
        'counterAccess',
        'onCaptured',
        'PayNote/Funds Captured',
        (steps) =>
          steps.replaceExpression(
            'SaveCapturedAmount',
            '/lastAmountCaptured',
            'event.amountCaptured',
          ),
      ),
      [
        {
          type: 'PayNote/PayNote Approved',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 42,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.lastAmountCaptured).toBe(42);
  });

  it('matches field-only response matcher when the matching item is second and ignores a nonmatching sibling', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument(
        'Field Matcher Second Item',
      ).onCallResponse(
        'counterAccess',
        'onCaptured42',
        {
          amountCaptured: 42,
        },
        (steps) =>
          steps
            .replaceValue('SetHandled', '/handled', true)
            .replaceExpression(
              'IncrementMatchCount',
              '/matchCount',
              "document('/matchCount') + 1",
            )
            .replaceExpression(
              'SaveCapturedAmount',
              '/lastAmountCaptured',
              'event.amountCaptured',
            ),
      ),
      [
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 13,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 42,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.handled).toBe(true);
    expect(processedJson.matchCount).toBe(1);
    expect(processedJson.lastAmountCaptured).toBe(42);
  });

  it('matches empty call-response matcher as a base response listener', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument(
        'Empty Call Response Matcher',
      ).onCallResponse('counterAccess', 'onAnyResponse', {}, (steps) =>
        steps
          .replaceValue('SetHandled', '/handled', true)
          .replaceExpression(
            'IncrementMatchCount',
            '/matchCount',
            "document('/matchCount') + 1",
          ),
      ),
      [
        {
          type: 'PayNote/PayNote Approved',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 42,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.handled).toBe(true);
    expect(processedJson.matchCount).toBe(2);
  });

  it('treats name-only call-response matcher as a field matcher, not a type alias', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument(
        'Named Call Response Matcher',
      ).onCallResponse(
        'counterAccess',
        'onNamedResponse',
        { name: 'Conversation/Event' },
        (steps) =>
          steps
            .replaceValue('SetHandled', '/handled', true)
            .replaceExpression(
              'IncrementMatchCount',
              '/matchCount',
              "document('/matchCount') + 1",
            ),
      ),
      [
        {
          type: 'Conversation/Response',
          name: 'Conversation/Event',
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.handled).toBe(true);
    expect(processedJson.matchCount).toBe(1);
  });

  it('does not match field-only response matcher when emitted fields do not match', async () => {
    const document = withCallResponseEnvelopeOperation(
      createCallResponseBaseDocument('Field Matcher Mismatch').onCallResponse(
        'counterAccess',
        'onCaptured42',
        {
          amountCaptured: 42,
        },
        (steps) =>
          steps
            .replaceValue('SetHandled', '/handled', true)
            .replaceExpression(
              'IncrementMatchCount',
              '/matchCount',
              "document('/matchCount') + 1",
            ),
      ),
      [
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 13,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
        {
          type: 'PayNote/Funds Captured',
          amountCaptured: 21,
          requestId: 'REQ_CALL',
          inResponseTo: {
            requestId: 'REQ_CALL',
          },
        },
      ],
    ).buildDocument();

    const processedJson = await processCallResponseOperation(document);
    expect(processedJson.handled).toBe(false);
    expect(processedJson.matchCount).toBe(0);
    expect(processedJson.lastAmountCaptured).toBe(0);
  });

  it('fails fast for basic start worker session agency helper without bindings', async () => {
    expect(() =>
      DocBuilder.doc()
        .name('Agency Start Worker Basic Runtime')
        .channel('ownerChannel', {
          type: 'Conversation/Timeline Channel',
          timelineId: 'owner-timeline',
        })
        .agency('workerAgency')
        .permissionFrom('ownerChannel')
        .allowedTypes('MyOS/MyOS Admin Base')
        .requestId('REQ_AGENCY')
        .done()
        .operation(
          'startWorkerBasic',
          'ownerChannel',
          Number,
          'start worker basic',
          (steps) =>
            steps.viaAgency('workerAgency').startWorkerSession('ownerChannel', {
              name: 'Basic Worker',
              type: 'MyOS/MyOS Admin Base',
            }),
        ),
    ).toThrow(
      'viaAgency(...).startSession(...) requires channel bindings; use startSessionWith(...)',
    );
  });
});
