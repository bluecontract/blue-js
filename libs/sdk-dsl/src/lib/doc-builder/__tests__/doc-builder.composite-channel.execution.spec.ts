import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../doc-builder.js';
import { toOfficialJson, toOfficialYaml } from '../../core/serialization.js';
import {
  createTestBlue,
  createTestDocumentProcessor,
  expectSuccess,
  operationRequestEvent,
  storedDocumentBlueId,
} from '../../../test-harness/runtime.js';

describe('doc-builder composite channel execution', () => {
  it('maps composite channel operation wiring', async () => {
    const blue = createTestBlue();
    const processor = createTestDocumentProcessor(blue);

    const document = DocBuilder.doc()
      .name('Composite Runtime')
      .field('/lastCompositeInvocation', null)
      .field('/lastCompositeSource', null)
      .channel('ownerChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .channel('allowedChannel', {
        type: 'Conversation/Timeline Channel',
        timelineId: 'allowed-timeline',
      })
      .compositeChannel('compositeChannel', 'ownerChannel', 'allowedChannel')
      .operation(
        'compositeOperation',
        'compositeChannel',
        Number,
        'Composite invocation recorder',
        (steps) =>
          steps.replaceExpression(
            'RecordCompositeInvocation',
            '/lastCompositeInvocation',
            'event.message.operation',
          ),
      )
      .onChannelEvent(
        'recordCompositeSource',
        'compositeChannel',
        'Conversation/Timeline Entry',
        (steps) =>
          steps.replaceExpression(
            'RecordCompositeSource',
            '/lastCompositeSource',
            'event.meta.compositeSourceChannelKey',
          ),
      )
      .buildDocument();
    const yaml = toOfficialYaml(document);
    expect(yaml).toContain(`compositeChannel:
    type: Conversation/Composite Timeline Channel
    channels:
      - ownerChannel
      - allowedChannel`);
    expect(yaml).toContain(`compositeOperation:
    description: Composite invocation recorder
    type: Conversation/Operation
    channel: compositeChannel`);

    const initialized = await expectSuccess(
      processor.initializeDocument(document),
      'composite runtime initialization failed',
    );
    const event = blue.jsonValueToNode({
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: 'owner-timeline',
      },
      message: {
        type: 'Conversation/Event',
        name: 'composite-check',
      },
    });
    const processed = await expectSuccess(
      processor.processDocument(initialized.document.clone(), event),
      'composite event processing failed',
    );

    expect(toOfficialJson(processed.document).lastCompositeSource).toBe(
      'ownerChannel',
    );
    const allowedEvent = blue.jsonValueToNode({
      type: 'Conversation/Timeline Entry',
      timeline: {
        timelineId: 'allowed-timeline',
      },
      message: {
        type: 'Conversation/Event',
        name: 'composite-check',
      },
    });
    const processedAllowed = await expectSuccess(
      processor.processDocument(processed.document.clone(), allowedEvent),
      'composite allowed-channel event processing failed',
    );

    expect(toOfficialJson(processedAllowed.document).lastCompositeSource).toBe(
      'allowedChannel',
    );
    const documentBlueId = storedDocumentBlueId(processedAllowed.document);
    const request = operationRequestEvent(blue, {
      operation: 'compositeOperation',
      request: 1,
      timelineId: 'owner-timeline',
      documentBlueId,
      allowNewerVersion: false,
    });
    const processedOperation = await expectSuccess(
      processor.processDocument(processedAllowed.document.clone(), request),
      'composite operation request processing failed',
    );

    expect(
      toOfficialJson(processedOperation.document).lastCompositeInvocation,
    ).toBe('compositeOperation');
  });
});
