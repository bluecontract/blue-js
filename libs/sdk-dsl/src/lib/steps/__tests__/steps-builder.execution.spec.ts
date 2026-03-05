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
});
