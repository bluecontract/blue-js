import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../doc-builder.js';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
  operationRequestEvent,
  storedDocumentBlueId,
} from '../../../test-harness/runtime.js';
import { toOfficialJson } from '../../core/serialization.js';

describe('doc-builder execution', () => {
  it('executes operation workflow and mutates document state', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const counterDoc = DocBuilder.doc()
      .name('Counter Runtime')
      .field('/counter', 0)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'increment',
        'ownerChannel',
        Number,
        'Increment counter',
        (steps) =>
          steps.replaceExpression(
            'IncrementCounter',
            '/counter',
            "document('/counter') + event.message.request",
          ),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(counterDoc),
      'Counter document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'increment',
      request: 5,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'Counter increment operation failed',
    );

    expect((toOfficialJson(processed.document).counter as number) ?? 0).toBe(5);
  });

  it('runs lifecycle workflow during initialization', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const initDoc = DocBuilder.doc()
      .name('Lifecycle Runtime')
      .field('/initialized', false)
      .onInit('markInitialized', (steps) =>
        steps.replaceValue('MarkInitialized', '/initialized', true),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(initDoc),
      'Lifecycle document initialization failed',
    );
    expect(toOfficialJson(initialized.document).initialized).toBe(true);
  });

  it('matches runtime named events and updates state via onNamedEvent workflow', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const namedEventDoc = DocBuilder.doc()
      .name('Named Event Runtime')
      .field('/namedHandled', false)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation(
        'emitNamed',
        'ownerChannel',
        Number,
        'Emit runtime named event',
        (steps) => steps.namedEvent('EmitStatusEvent', 'status-ready'),
      )
      .onNamedEvent('onStatusReady', 'status-ready', (steps) =>
        steps.replaceValue('SetNamedHandled', '/namedHandled', true),
      )
      .buildDocument();

    const initialized = await expectSuccess(
      processor.initializeDocument(namedEventDoc),
      'Named event document initialization failed',
    );
    const documentBlueId = storedDocumentBlueId(initialized.document);

    const event = operationRequestEvent(blue, {
      operation: 'emitNamed',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'Named event operation failed',
    );

    expect(toOfficialJson(processed.document).namedHandled).toBe(true);
  });
});
