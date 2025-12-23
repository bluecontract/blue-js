import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  property,
  stringProperty,
  typeBlueId,
} from '../../../../__tests__/test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as coreBlueIds } from '@blue-repository/types/packages/core/blue-ids';

const blue = createBlue();

describe('JavaScriptCodeStepExecutor (integration)', () => {
  it('runs JS code on lifecycle init and emits event payload', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code Workflow Doc
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Compute
        type: Conversation/JavaScript Code
        code: |
          return { value: 12 };
      - name: Emit
        type: Conversation/JavaScript Code
        code: |
          const result = steps.Compute.value + 8;
          return {
            events: [
              {
                type: "Conversation/Chat Message",
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
      (e) => typeBlueId(e) === conversationBlueIds['Conversation/Chat Message'],
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
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Boom
        type: Conversation/JavaScript Code
        code: |
          throw new Error("boom");
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const terminated = property(
      property(result.document, 'contracts'),
      'terminated',
    );
    expect(stringProperty(terminated, 'cause')).toBe('fatal');
    const reason = stringProperty(terminated, 'reason');
    expect(reason).toBeTruthy();
    expect(reason).toMatch(/Failed to evaluate code block/i);

    const terminationEvents = result.triggeredEvents.filter(
      (event) =>
        typeBlueId(event) ===
        coreBlueIds['Core/Document Processing Terminated'],
    );
    expect(terminationEvents.length).toBe(1);
    expect(stringProperty(terminationEvents[0], 'cause')).toBe('fatal');
    expect(stringProperty(terminationEvents[0], 'reason')).toMatch(
      /Failed to evaluate code block/i,
    );
  });

  it('delivers JS-emitted events to Triggered Event Channel consumers', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code Triggers Triggered Channel
contracts:
  life:
    type: Core/Lifecycle Event Channel
  trig:
    type: Core/Triggered Event Channel
  producer:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: EmitStatus
        type: Conversation/JavaScript Code
        code: |
          return {
            events: [
              { type: "Conversation/Status Completed" }
            ]
          };
  consumer:
    type: Conversation/Sequential Workflow
    channel: trig
    event:
      type: Conversation/Status Completed
    steps:
      - name: EmitChat
        type: Conversation/JavaScript Code
        code: |
          return {
            events: [
              {
                type: "Conversation/Chat Message",
                message: "Triggered via Triggered Event Channel"
              }
            ]
          };
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const emissions = result.triggeredEvents;

    const completedEvents = emissions.filter(
      (e) =>
        typeBlueId(e) === conversationBlueIds['Conversation/Status Completed'],
    );
    expect(completedEvents.length).toBe(1);

    const chatEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Conversation/Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
    const message = property(chatEvents[0], 'message').getValue();
    expect(message).toBe('Triggered via Triggered Event Channel');
  });
});
