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

describe('steps-builder execution', () => {
  it('emits trigger events from operation steps during processing', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step Events Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitEvents',
        'ownerChannel',
        Number,
        'Emit helper events',
        (steps) =>
          steps
            .emitType(
              'EmitConversationEvent',
              'Conversation/Event',
              (payload) => payload.put('topic', 'hello'),
            )
            .namedEvent('EmitNamedEvent', 'status', (payload) =>
              payload.put('state', 'ok'),
            ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'Step events document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitEvents',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'Step events operation failed',
    );

    const triggeredEvents = processed.triggeredEvents.map((triggeredEvent) =>
      toOfficialJson(triggeredEvent),
    );
    expect(triggeredEvents).toEqual([
      {
        type: 'Conversation/Event',
        topic: 'hello',
      },
      {
        type: 'Conversation/Event',
        name: 'status',
        payload: {
          state: 'ok',
        },
      },
    ]);
  });

  it('emits bootstrap document requests from helper steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step Bootstrap Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'bootstrapChild',
        'ownerChannel',
        Number,
        'Emit bootstrap request',
        (steps) =>
          steps.bootstrapDocument(
            'Bootstrap',
            {
              name: 'Child Runtime',
              summary: 'child bootstrap payload',
            },
            {
              ownerChannel: 'target-session',
            },
            (payload) => payload.put('bootstrapAssignee', 'myOsAdminChannel'),
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step bootstrap document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'bootstrapChild',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step bootstrap operation failed',
    );

    const bootstrapEvent = processed.triggeredEvents
      .map((triggeredEvent) => toOfficialJson(triggeredEvent))
      .find(
        (triggeredEvent) =>
          triggeredEvent.type === 'Conversation/Document Bootstrap Requested',
      );
    expect(bootstrapEvent).toBeDefined();
    expect(bootstrapEvent).toMatchObject({
      channelBindings: {
        ownerChannel: 'target-session',
      },
      bootstrapAssignee: 'myOsAdminChannel',
      document: {
        name: 'Child Runtime',
        summary: 'child bootstrap payload',
      },
    });
  });

  it('emits MyOS helper events from operation steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step MyOS Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitMyOsEvents',
        'ownerChannel',
        Number,
        'Emit MyOS helper events',
        (steps) =>
          steps
            .myOs()
            .addParticipant('ownerChannel', 'user@example.com')
            .myOs()
            .removeParticipant('ownerChannel')
            .myOs()
            .callOperation('ownerChannel', 'target-session', 'syncState', {
              type: 'Conversation/Event',
            })
            .myOs()
            .subscribeToSession(
              'ownerChannel',
              'target-session',
              'SUB_MYOS',
              'Conversation/Response',
            ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step myos document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitMyOsEvents',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step myos operation failed',
    );

    const triggeredEvents = processed.triggeredEvents.map((triggeredEvent) =>
      toOfficialJson(triggeredEvent),
    );
    const eventTypes = triggeredEvents.map(
      (triggeredEvent) => triggeredEvent.type,
    );
    expect(eventTypes).toContain('MyOS/Adding Participant Requested');
    expect(eventTypes).toContain('MyOS/Removing Participant Requested');
    expect(eventTypes).toContain('MyOS/Call Operation Requested');
    expect(eventTypes).toContain('MyOS/Subscribe to Session Requested');

    const callRequest = triggeredEvents.find(
      (triggeredEvent) =>
        triggeredEvent.type === 'MyOS/Call Operation Requested',
    );
    expect(callRequest).toMatchObject({
      operation: 'syncState',
      targetSessionId: 'target-session',
    });
  });

  it('emits events from raw extension hook steps', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Step Raw Runtime')
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitRawEvent',
        'ownerChannel',
        Number,
        'Emit raw helper event',
        (steps) =>
          steps.raw({
            name: 'CustomRawStep',
            type: 'Conversation/Trigger Event',
            event: {
              type: 'Conversation/Event',
              name: 'raw-event',
              payload: {
                source: 'raw-step',
              },
            },
          }),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'step raw document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitRawEvent',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'step raw operation failed',
    );

    const rawEvent = processed.triggeredEvents
      .map((triggeredEvent) => toOfficialJson(triggeredEvent))
      .find(
        (triggeredEvent) =>
          triggeredEvent.type === 'Conversation/Event' &&
          triggeredEvent.name === 'raw-event',
      );
    expect(rawEvent).toBeDefined();
    expect(rawEvent).toMatchObject({
      payload: {
        source: 'raw-step',
      },
    });
  });
});
