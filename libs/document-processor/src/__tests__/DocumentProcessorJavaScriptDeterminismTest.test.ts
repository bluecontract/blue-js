import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { describe, expect, it } from 'vitest';

import { DocumentProcessor } from '../api/document-processor.js';
import { hostGasToWasmFuel } from '../runtime/gas-schedule.js';
import { blueIds, createBlue } from '../test-support/blue.js';
import {
  expectOk,
  numericProperty,
  property,
  stringProperty,
  typeBlueId,
} from './test-utils.js';

const blue = createBlue();

function fatalTerminationReason(result: Awaited<ReturnType<typeof expectOk>>) {
  const terminated = property(
    property(result.document, 'contracts'),
    'terminated',
  );
  expect(stringProperty(terminated, 'cause')).toBe('fatal');
  return stringProperty(terminated, 'reason') ?? '';
}

describe('DocumentProcessor JavaScript determinism', () => {
  it('produces identical documents, events, and gas for repeated evaluation', async () => {
    const processor = new DocumentProcessor({ blue });
    const yaml = `name: Deterministic JS Workflow
counter: 7
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
          let total = document('/counter');
          for (let i = 0; i < 8; i += 1) {
            total += i;
          }
          return { total };
      - name: Apply
        type: Conversation/Update Document
        changeset:
          - op: ADD
            path: /computed
            val: "\${steps.Compute.total}"
`;

    const first = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );
    const second = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    expect(blue.nodeToJson(first.document, 'simple')).toEqual(
      blue.nodeToJson(second.document, 'simple'),
    );
    expect(
      first.triggeredEvents.map((event) => blue.nodeToJson(event)),
    ).toEqual(second.triggeredEvents.map((event) => blue.nodeToJson(event)));
    expect(first.totalGas).toBe(second.totalGas);
    expect(numericProperty(first.document, 'computed')).toBe(35);
  });

  it('exposes document, canonical document, emit, steps, event, and currentContract through real workflows', async () => {
    const processor = new DocumentProcessor({ blue });
    const yaml = `name: Workflow Binding Coverage
counter: 3
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    description: Host binding workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Previous
        type: Conversation/JavaScript Code
        code: |
          return { value: document('/counter') + 1 };
      - name: UseBindings
        type: Conversation/JavaScript Code
        code: |
          const canonicalCounter = document.canonical('/counter');
          const canonicalValue =
            canonicalCounter &&
            typeof canonicalCounter === 'object' &&
            Object.prototype.hasOwnProperty.call(canonicalCounter, 'value')
              ? canonicalCounter.value
              : canonicalCounter;
          emit({
            type: 'Conversation/Chat Message',
            message: currentContract.description + ':' + steps.Previous.value
          });
          return {
            plainCounter: document('/counter'),
            canonicalCounter: canonicalValue,
            previous: steps.Previous.value,
            contractDescription: currentContract.description,
            hasEvent: event != null,
            hasEventCanonical: eventCanonical != null
          };
      - name: Persist
        type: Conversation/Update Document
        changeset:
          - op: ADD
            path: /bindingResult
            val: "\${steps.UseBindings}"
`;

    const result = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const bindingResult = property(result.document, 'bindingResult');
    expect(numericProperty(bindingResult, 'plainCounter')).toBe(3);
    expect(numericProperty(bindingResult, 'canonicalCounter')).toBe(3);
    expect(numericProperty(bindingResult, 'previous')).toBe(4);
    expect(stringProperty(bindingResult, 'contractDescription')).toBe(
      'Host binding workflow',
    );
    expect(property(bindingResult, 'hasEvent').getValue()).toBe(true);
    expect(property(bindingResult, 'hasEventCanonical').getValue()).toBe(true);

    const chatEvents = result.triggeredEvents.filter(
      (event) =>
        typeBlueId(event) === conversationBlueIds['Conversation/Chat Message'],
    );
    expect(chatEvents).toHaveLength(1);
    expect(stringProperty(chatEvents[0], 'message')).toBe(
      'Host binding workflow:4',
    );
  });

  it('terminates expression evaluation when expression gas is exhausted', async () => {
    const processor = new DocumentProcessor({
      blue,
      javascript: {
        jsExpressionGasLimit: hostGasToWasmFuel(1000),
      },
    });
    const yaml = `name: JS Expression Out Of Gas
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Spin
        type: Conversation/Update Document
        changeset:
          - op: ADD
            path: /never
            val: "\${(() => { while (true) {} })()}"
`;

    const result = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const reason = fatalTerminationReason(result);
    expect(reason).toMatch(/Failed to evaluate code block/i);
    expect(reason).toMatch(/OutOfGas|out of gas|while \(true\)/i);
    expect(
      result.triggeredEvents.some(
        (event) =>
          typeBlueId(event) === blueIds['Core/Document Processing Terminated'],
      ),
    ).toBe(true);
  });

  it('terminates JavaScript Code steps when step gas is exhausted', async () => {
    const processor = new DocumentProcessor({
      blue,
      javascript: {
        jsCodeStepGasLimit: hostGasToWasmFuel(1000),
      },
    });
    const yaml = `name: JS Code Out Of Gas
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Spin
        type: Conversation/JavaScript Code
        code: |
          while (true) {}
`;

    const result = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const reason = fatalTerminationReason(result);
    expect(reason).toMatch(/Failed to evaluate code block/i);
    expect(reason).toMatch(/OutOfGas|out of gas|while \(true\)/i);
  });

  it.each([
    {
      name: 'invalid document pointer',
      code: 'return document(123);',
      reasonPattern: /HostError|invalid_path|document/i,
    },
    {
      name: 'invalid output value',
      code: "return Symbol('not-dv');",
      reasonPattern: /InvalidOutput|unsupported|Symbol|not-dv|DV/i,
    },
    {
      name: 'invalid emit payload',
      code: 'emit(undefined); return 1;',
      reasonPattern: /emit\(undefined\)/i,
    },
  ])('maps $name failures to fatal processor termination', async (testCase) => {
    const processor = new DocumentProcessor({ blue });
    const yaml = `name: JS Invalid Host Use
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Invalid
        type: Conversation/JavaScript Code
        code: |
          ${testCase.code}
`;

    const result = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const reason = fatalTerminationReason(result);
    expect(reason).toMatch(/Failed to evaluate code block/i);
    expect(reason).toMatch(testCase.reasonPattern);
  });
});
