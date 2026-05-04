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
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { blueIds as coreBlueIds } from '@blue-repository/types/packages/core/blue-ids';
import { JavaScriptCodeStepExecutor } from '../javascript-code-step-executor.js';
import { BlueQuickJsEngine } from '../../../../util/expression/javascript-evaluation-engine.js';

const blue = createBlue();

describe('JavaScriptCodeStepExecutor (integration)', () => {
  it('executes JavaScript Code v2 inline module mode', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code v2 Inline Module Workflow
counter: 4
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
        type: Conversation/JavaScript Code v2
        mode: module
        code: |
          import { next } from './math.js';

          export default {
            events: [
              {
                type: 'Conversation/Chat Message',
                message: 'next=' + next(document('/counter'))
              }
            ]
          };
        modules:
          './math.js': |
            export function next(value) {
              return value + 1;
            }
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));
    const chatMessages = result.triggeredEvents
      .filter(
        (event) =>
          typeBlueId(event) ===
          conversationBlueIds['Conversation/Chat Message'],
      )
      .map((event) => stringProperty(event, 'message'));

    expect(chatMessages).toEqual(['next=5']);
  });

  it('executes JavaScript Code v2 reusable source library mode', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code v2 Library Workflow
counter: 7
contracts:
  life:
    type: Core/Lifecycle Event Channel
  mathLibrary:
    type: Conversation/JavaScript Library
    modules:
      './math.js': |
        export function next(value) {
          return value + 1;
        }
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Compute
        type: Conversation/JavaScript Code v2
        mode: module
        libraries:
          - /contracts/mathLibrary
        code: |
          import { next } from './math.js';

          export default {
            events: [
              {
                type: 'Conversation/Chat Message',
                message: 'next=' + next(document('/counter'))
              }
            ]
          };
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));
    const chatMessages = result.triggeredEvents
      .filter(
        (event) =>
          typeBlueId(event) ===
          conversationBlueIds['Conversation/Chat Message'],
      )
      .map((event) => stringProperty(event, 'message'));

    expect(chatMessages).toEqual(['next=8']);
  });

  it('terminates JavaScript Code v2 before evaluation when a static import is missing', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code v2 Missing Import Workflow
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: MissingImport
        type: Conversation/JavaScript Code v2
        mode: module
        code: |
          import { missing } from './missing.js';
          export default missing;
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));
    const terminated = property(
      property(result.document, 'contracts'),
      'terminated',
    );

    expect(stringProperty(terminated, 'cause')).toBe('fatal');
    expect(stringProperty(terminated, 'reason')).toMatch(/MISSING_IMPORT/);
  });

  it('supports JavaScript Code v2 module emit() and result events', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code v2 Emit Workflow
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: EmitFromModule
        type: Conversation/JavaScript Code v2
        mode: module
        code: |
          emit({
            type: 'Conversation/Chat Message',
            message: 'direct v2 module emit'
          });

          export default {
            events: [
              {
                type: 'Conversation/Chat Message',
                message: 'result v2 module event'
              }
            ]
          };
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));
    const chatMessages = result.triggeredEvents
      .filter(
        (event) =>
          typeBlueId(event) ===
          conversationBlueIds['Conversation/Chat Message'],
      )
      .map((event) => stringProperty(event, 'message'))
      .sort();

    expect(chatMessages).toEqual([
      'direct v2 module emit',
      'result v2 module event',
    ]);
  });

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

  it('supports deterministic JSON.parse and JSON.stringify inside JS code', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Code Deterministic JSON Workflow
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Canonicalize
        type: Conversation/JavaScript Code
        code: |
          const parsed = JSON.parse('{"aa":1,"b":2}');
          const canonical = JSON.stringify(parsed);
          return {
            events: [
              {
                type: "Conversation/Chat Message",
                message: canonical
              }
            ]
          };
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));

    const emissions = result.triggeredEvents;
    const chatEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Conversation/Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
    const message = property(chatEvents[0], 'message').getValue();
    expect(message).toBe('{"b":2,"aa":1}');
  });

  it('executes a sequential workflow step and charges wasm gas', async () => {
    const executor = new JavaScriptCodeStepExecutor(new BlueQuickJsEngine());
    const code =
      'return { result: document("/counter") + event.payload.delta };';
    const stepNode = blue.yamlToNode(
      `type: Conversation/JavaScript Code
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
