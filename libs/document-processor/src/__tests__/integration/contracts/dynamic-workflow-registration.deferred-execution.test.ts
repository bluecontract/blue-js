import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { createBlue } from '../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
  propertyOptional,
  makeTimelineEntry,
} from '../../test-utils.js';

const blue = createBlue();

describe('Contract Bundle — Dynamic workflow registration (deferred execution)', () => {
  it('only executes dynamically added workflows in later processing cycles', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Dynamic Workflow Doc
counter: 0
dynamicRan: 0
staticRan: 0
contracts:
  timeline:
    type: Conversation/Timeline Channel
    timelineId: alpha
  counterUpdate:
    type: Core/Document Update Channel
    path: /counter
  staticWatcher:
    channel: counterUpdate
    type: Conversation/Sequential Workflow
    steps:
      - name: SetStaticRan
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /staticRan
            val: 1
  mutateContracts:
    type: Conversation/Sequential Workflow
    channel: timeline
    steps:
      - name: AddDynamicWorkflow
        type: Conversation/Update Document
        changeset:
          - op: ADD
            path: /contracts/newWorkflow
            val:
              type: Conversation/Sequential Workflow
              channel: counterUpdate
              steps:
                - name: FlagDynamic
                  type: Conversation/Update Document
                  changeset:
                    - op: REPLACE
                      path: /dynamicRan
                      val: 1
      - name: TouchCounter
        type: Conversation/Update Document
        changeset:
          - op: REPLACE
            path: /counter
            val: "\${document('/counter') + 1}"
`;

    const initialized = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const afterFirst = await expectOk(
      processor.processDocument(
        initialized.document.clone(),
        makeTimelineEntry(blue, 'alpha', 'mutate contracts'),
      ),
    );

    const contractsNode = property(afterFirst.document, 'contracts');
    expect(propertyOptional(contractsNode, 'newWorkflow')).toBeInstanceOf(
      BlueNode,
    );

    expect(numericValue(property(afterFirst.document, 'counter'))).toBe(1);
    expect(numericValue(property(afterFirst.document, 'staticRan'))).toBe(1);
    expect(numericValue(property(afterFirst.document, 'dynamicRan'))).toBe(0);

    const afterSecond = await expectOk(
      processor.processDocument(
        afterFirst.document.clone(),
        makeTimelineEntry(blue, 'alpha', 'mutate contracts again'),
      ),
    );

    expect(numericValue(property(afterSecond.document, 'counter'))).toBe(2);
    expect(numericValue(property(afterSecond.document, 'staticRan'))).toBe(1);
    expect(numericValue(property(afterSecond.document, 'dynamicRan'))).toBe(1);
  });
});
