import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
  makeTimelineEntryYaml,
} from '../test-support/runtime.js';

describe('sdk e2e: basic operation', () => {
  it('processes timeline operation request and updates document state', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Basic operation doc')
      .field('/count', 0)
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'owner-timeline',
      })
      .operation('increment')
      .channel('ownerChannel')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression(
          'ApplyIncrement',
          '/count',
          "document('/count') + event.message.request",
        ),
      )
      .done()
      .toYaml();

    const init = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    const event = blue.yamlToNode(
      makeTimelineEntryYaml(
        'owner-timeline',
        `type: Conversation/Operation Request
operation: increment
request: 7`,
      ),
    );
    const processed = await expectOk(
      processor.processDocument(init.document.clone(), event),
    );

    expect(Number(processed.document.get('/count'))).toBe(7);
  });
});
