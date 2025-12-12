import { describe, expect, it, vi } from 'vitest';

import { createBlue } from '../../../../test-support/blue.js';
import {
  createArgs,
  createRealContext,
} from '../../../../test-support/workflow.js';
import {
  buildProcessor,
  expectOk,
  property,
  stringProperty,
  typeBlueId,
} from '../../../../__tests__/test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';
import { blueIds as coreBlueIds } from '@blue-repository/core';
import { JavaScriptCodeStepExecutor } from '../javascript-code-step-executor.js';

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
        typeBlueId(event) === coreBlueIds['Document Processing Terminated'],
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
    type: Lifecycle Event Channel
  trig:
    type: Triggered Event Channel
  producer:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: EmitStatus
        type: JavaScript Code
        code: |
          return {
            events: [
              { type: "Status Completed" }
            ]
          };
  consumer:
    type: Sequential Workflow
    channel: trig
    event:
      type: Status Completed
    steps:
      - name: EmitChat
        type: JavaScript Code
        code: |
          return {
            events: [
              {
                type: "Chat Message",
                message: "Triggered via Triggered Event Channel"
              }
            ]
          };
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const emissions = result.triggeredEvents;

    const completedEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Status Completed'],
    );
    expect(completedEvents.length).toBe(1);

    const chatEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
    const message = property(chatEvents[0], 'message').getValue();
    expect(message).toBe('Triggered via Triggered Event Channel');
  });

  it('executes a sequential workflow step and charges wasm gas', async () => {
    const executor = new JavaScriptCodeStepExecutor();
    const code =
      'return { result: document("/counter") + event.payload.delta };';
    const stepNode = blue.yamlToNode(
      `type: JavaScript Code
name: Compute
code: ${JSON.stringify(code)}
`,
    );
    const eventNode = blue.jsonValueToNode({ payload: { delta: 7 } });
    const { context, execution } = createRealContext(blue, eventNode);
    execution.runtime().directWrite('/counter', blue.jsonValueToNode(5));

    const baseArgs = createArgs({ context, stepNode, eventNode });
    const args = { ...baseArgs, workflow: { steps: [stepNode] } };

    const initialGas = context.gasMeter().totalGas();
    const wasmSpy = vi.spyOn(context.gasMeter(), 'chargeWasmGas');

    const result = await executor.execute(args);

    expect(result).toEqual({ result: 12 });
    expect(wasmSpy).toHaveBeenCalled();

    const postGas = context.gasMeter().totalGas();
    // WASM fuel metering charges actual VM execution cost
    expect(postGas).toBeGreaterThan(initialGas);
  });
});
