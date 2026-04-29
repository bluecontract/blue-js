import { describe, expect, it } from 'vitest';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

import {
  JAVASCRIPT_MODULE_BLUE_ID,
  JAVASCRIPT_MODULE_CODE_STEP_BLUE_ID,
} from '../../../../constants/javascript-module-constants.js';
import { createBlue } from '../../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericProperty,
  property,
  stringProperty,
  typeBlueId,
} from '../../../../__tests__/test-utils.js';

const blue = createBlue();

describe('JavaScriptModuleStepExecutor (integration)', () => {
  it('executes module contracts referenced by a Blue workflow step', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Module Workflow Doc
counter: 4
contracts:
  life:
    type: Core/Lifecycle Event Channel
  helper:
    type:
      name: Conversation/JavaScript Module
      blueId: ${JAVASCRIPT_MODULE_BLUE_ID}
    specifier: ./helper.js
    source: |
      export function next(value) {
        return value + 1;
      }
  entry:
    type:
      name: Conversation/JavaScript Module
      blueId: ${JAVASCRIPT_MODULE_BLUE_ID}
    specifier: ./entry.js
    source: |
      import { next } from './helper.js';

      export default {
        next: next(document('/counter')),
        events: [
          {
            type: 'Conversation/Chat Message',
            message: 'next=' + next(document('/counter'))
          }
        ]
      };
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Compute
        type:
          name: Conversation/JavaScript Module Code
          blueId: ${JAVASCRIPT_MODULE_CODE_STEP_BLUE_ID}
        entrySpecifier: ./entry.js
        modules:
          - /contracts/entry
          - /contracts/helper
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

    expect(numericProperty(result.document, 'counter')).toBe(4);
    expect(chatMessages).toEqual(['next=5']);
  });

  it('supports module emit() and result events', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Module Emit Workflow Doc
contracts:
  life:
    type: Core/Lifecycle Event Channel
  entry:
    type:
      name: Conversation/JavaScript Module
      blueId: ${JAVASCRIPT_MODULE_BLUE_ID}
    specifier: ./entry.js
    source: |
      emit({
        type: 'Conversation/Chat Message',
        message: 'direct module emit'
      });

      export default {
        events: [
          {
            type: 'Conversation/Chat Message',
            message: 'result module event'
          }
        ]
      };
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: EmitFromModule
        type:
          name: Conversation/JavaScript Module Code
          blueId: ${JAVASCRIPT_MODULE_CODE_STEP_BLUE_ID}
        entrySpecifier: ./entry.js
        modules:
          - /contracts/entry
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

    expect(chatMessages).toEqual(['direct module emit', 'result module event']);
  });

  it('terminates fatally when a referenced module is missing', async () => {
    const processor = buildProcessor(blue);

    const yaml = `name: JS Module Missing Dependency Doc
contracts:
  life:
    type: Core/Lifecycle Event Channel
  onInit:
    type: Conversation/Sequential Workflow
    channel: life
    event:
      type: Core/Document Processing Initiated
    steps:
      - name: Missing
        type:
          name: Conversation/JavaScript Module Code
          blueId: ${JAVASCRIPT_MODULE_CODE_STEP_BLUE_ID}
        entrySpecifier: ./entry.js
        modules:
          - /contracts/missing
`;

    const doc = blue.yamlToNode(yaml);
    const result = await expectOk(processor.initializeDocument(doc));
    const terminated = property(
      property(result.document, 'contracts'),
      'terminated',
    );

    expect(stringProperty(terminated, 'cause')).toBe('fatal');
    expect(stringProperty(terminated, 'reason')).toMatch(
      /JavaScript module not found/,
    );
  });
});
