import { describe, expect, it } from 'vitest';
import { DocBuilder } from '../builders/doc-builder.js';
import {
  expectOk,
  getBlue,
  getBlueDocumentProcessor,
  makeTimelineEntryYaml,
} from '../test-support/runtime.js';

describe('sdk e2e: llm provider pattern', () => {
  it('proxies operation requests through sequential workflow operation', async () => {
    const blue = getBlue();
    const processor = getBlueDocumentProcessor(blue);

    const yaml = DocBuilder.doc()
      .name('LLM provider e2e')
      .channel('llmChannel', {
        type: 'MyOS/MyOS Timeline Channel',
        timelineId: 'llm-session',
      })
      .operation('proxyPrompt')
      .channel('llmChannel')
      .requestType('Dictionary')
      .steps((steps) =>
        steps.jsRaw(
          'ProxyPrompt',
          'return { events: [event.message.request] };',
        ),
      )
      .done()
      .toYaml();

    const initialized = await expectOk(
      processor.initializeDocument(blue.resolve(blue.yamlToNode(yaml))),
    );

    const event = blue.yamlToNode(
      makeTimelineEntryYaml(
        'llm-session',
        `type: Conversation/Operation Request
operation: proxyPrompt
request:
  type: Conversation/Event
  name: LLM_PROMPT`,
      ),
    );
    const processed = await expectOk(
      processor.processDocument(initialized.document.clone(), event),
    );

    expect(processed.capabilityFailure).toBe(false);
    expect(String(processed.document.get('/name'))).toBe('LLM provider e2e');
  });
});
