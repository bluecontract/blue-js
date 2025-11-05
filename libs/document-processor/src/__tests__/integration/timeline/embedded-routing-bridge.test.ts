import { describe, expect, it } from 'vitest';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';

import { createBlue } from '../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  numericValue,
  property,
  stringProperty,
  typeBlueId,
  makeTimelineEntry,
} from '../../test-utils.js';

const blue = createBlue();

describe('Timeline — Embedded routing with bridge', () => {
  it('routes shared timeline entries through embedded workflows and bridges emitted events', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Timeline Routing Doc
x: 0
sub1:
  name: Sub Workflow Doc
  x: 1
  contracts:
    alice:
      type: Timeline Channel
      timelineId: alice
    subWorkflow:
      type: Sequential Workflow
      channel: alice
      steps:
        - name: UpdateSubX
          type: Update Document
          changeset:
            - op: REPLACE
              path: /x
              val: 2
        - name: EmitPayment
          type: Trigger Event
          event:
            type: Chat Message
            message: Payment Succeeded for Alice
sub2:
  y: 1
contracts:
  embeddedSub1:
    type: Process Embedded
    paths:
      - /sub1
  sub1Bridge:
    type: Embedded Node Channel
    childPath: /sub1
  alice:
    type: Timeline Channel
    timelineId: alice
  workflowRootSetOne:
    type: Sequential Workflow
    channel: alice
    order: 0
    steps:
      - name: SetRootOne
        type: Update Document
        changeset:
          - op: REPLACE
            path: /x
            val: 1
  workflowRootSetFive:
    type: Sequential Workflow
    channel: alice
    order: 1
    steps:
      - name: SetRootFive
        type: Update Document
        changeset:
          - op: REPLACE
            path: /x
            val: 5
  workflowFromSub:
    type: Sequential Workflow
    channel: sub1Bridge
    steps:
      - name: SetRootTen
        type: Update Document
        changeset:
          - op: REPLACE
            path: /x
            val: 10
      - name: ReEmitPayment
        type: Trigger Event
        event:
          type: Chat Message
          message: Payment Succeeded for Alice
`;

    const initialized = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const event = makeTimelineEntry(
      blue,
      'alice',
      'External trigger for alice',
    );
    const processed = await expectOk(
      processor.processDocument(initialized.document.clone(), event),
    );

    expect(numericValue(property(processed.document, 'x'))).toBe(10);
    const sub1Node = property(processed.document, 'sub1');
    expect(numericValue(property(sub1Node, 'x'))).toBe(2);
    const sub2Node = property(processed.document, 'sub2');
    expect(numericValue(property(sub2Node, 'y'))).toBe(1);

    expect(processed.triggeredEvents).toHaveLength(1);
    const emitted = processed.triggeredEvents[0]!;
    expect(typeBlueId(emitted)).toBe(conversationBlueIds['Chat Message']);
    expect(stringProperty(emitted, 'message')).toBe(
      'Payment Succeeded for Alice',
    );
  });
});
