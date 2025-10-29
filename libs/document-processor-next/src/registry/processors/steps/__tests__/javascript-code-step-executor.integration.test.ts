import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  property,
  typeBlueId,
} from '../../../../__tests__/test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';
import { CodeBlockEvaluationError } from '../../../../util/exceptions.js';

const blue = createBlue();

describe('JavaScriptCodeStepExecutor (integration)', () => {
  it('runs JS code on lifecycle init and emits event payload', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code Workflow Doc
contracts:
  life:
    type: Lifecycle Event Channel
  onInit:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: Compute
        type: JavaScript Code
        code: |
          return { value: 12 };
      - name: Emit
        type: JavaScript Code
        code: |
          const result = steps.Compute.value + 8;
          return {
            events: [
              {
                type: "Chat Message",
                message: "Result is " + result
              }
            ]
          };
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    // Should include initialization lifecycle event and the Chat Message emitted by JS step
    const emissions = result.triggeredEvents;
    const chatEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
    const message = property(chatEvents[0], 'message').getValue();
    expect(message).toBe('Result is 20');
  });

  it('wraps thrown errors from JS step as CodeBlockEvaluationError', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code Workflow Doc (error)
contracts:
  life:
    type: Lifecycle Event Channel
  onInit:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: Boom
        type: JavaScript Code
        code: |
          throw new Error("boom");
`;

    const doc = blue.yamlToNode(yaml);
    await expect(processor.initializeDocument(doc)).rejects.toThrow(
      CodeBlockEvaluationError,
    );
  });
});
