import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
  makeTimelineEntryYaml,
} from '../test-support/runtime.js';

describe('sdk e2e: embedded document update', () => {
  it('triggers document update watcher after operation updates path', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('Embedded/doc-update e2e')
      .field('/value', 0)
      .field('/docChanged', false)
      .channel('ownerChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'owner-session',
      })
      .operation('setValue')
      .channel('ownerChannel')
      .requestType('Integer')
      .steps((steps) =>
        steps.replaceExpression('SetValue', '/value', 'event.message.request'),
      )
      .done()
      .onDocChange('watchValue', '/value', (steps) =>
        steps.replaceValue('MarkChanged', '/docChanged', true),
      )
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    const event = blue.yamlToNode(
      makeTimelineEntryYaml(
        'owner-session',
        `type: Conversation/Operation Request
operation: setValue
request: 9`,
      ),
    );
    const processed = await expectOk(
      processor.processDocument(initialized.document.clone(), event),
    );

    expect(Number(processed.document.get('/value'))).toBe(9);
    expect(processed.document.get('/docChanged')).toBe(true);
  });
});
