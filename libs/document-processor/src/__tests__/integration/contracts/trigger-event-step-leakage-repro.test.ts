import { describe, it, expect } from 'vitest';
import { createBlue } from '../../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  property,
  typeBlueId,
} from '../../test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';

const blue = createBlue();

describe('Trigger Event step — leakage into root flow', () => {
  it('does not evaluate expressions inside nested document in Trigger Event payload', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Leakage Repro Doc
counter: 0
contracts:
  life:
    type: Lifecycle Event Channel
  onInit:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: EmitStartWithChildDoc
        type: Trigger Event
        event:
          type: Chat Message
          message: start-session
          document:
            name: Child Session
            counter: 0
            contracts:
              increment:
                type: Operation
                request:
                  type: Integer
              incrementImpl:
                type: Sequential Workflow Operation
                operation: increment
                steps:
                  - name: IncreaseCounter
                    type: Update Document
                    changeset:
                      - op: replace
                        path: /counter
                        val: "\${document('counter') + event.request.value}"
`;

    const result = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const emissions = result.triggeredEvents;
    expect(emissions.length).toBeGreaterThan(0);
    const chatEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
    const [event] = chatEvents;

    const nestedDocument = property(event, 'document');
    const nestedJson = blue.nodeToJson(nestedDocument, 'original') as {
      contracts: {
        incrementImpl: {
          steps: Array<{ changeset: Array<{ val: string }> }>;
        };
      };
    };

    const val = nestedJson.contracts.incrementImpl.steps[0].changeset[0].val;
    expect(val).toBe("${document('counter') + event.request.value}");
  });

  it('does not evaluate expressions when Trigger Event payload comes from a document snapshot', async () => {
    const processor = buildProcessor(blue);
    const yaml = `name: Leakage Repro Doc With Root Event
counter: 0
eventToTrigger:
  type: Chat Message
  message: start-session
  document:
    name: Child Session
    counter: 0
    contracts:
      increment:
        type: Operation
        request:
          type: Integer
      incrementImpl:
        type: Sequential Workflow Operation
        operation: increment
        steps:
          - name: IncreaseCounter
            type: Update Document
            changeset:
              - op: replace
                path: /counter
                val: "\${document('counter') + event.request.value}"
contracts:
  life:
    type: Lifecycle Event Channel
  onInit:
    type: Sequential Workflow
    channel: life
    event:
      type: Document Processing Initiated
    steps:
      - name: EmitStartWithSnapshot
        type: Trigger Event
        event: "\${document('/eventToTrigger')}"
`;

    const result = await expectOk(
      processor.initializeDocument(blue.yamlToNode(yaml)),
    );

    const emissions = result.triggeredEvents;
    expect(emissions.length).toBeGreaterThan(0);
    const chatEvents = emissions.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
    const [event] = chatEvents;

    const nestedDocument = property(event, 'document');
    const nestedJson = blue.nodeToJson(nestedDocument, 'original') as {
      contracts: {
        incrementImpl: {
          steps: Array<{ changeset: Array<{ val: string }> }>;
        };
      };
    };

    const val = nestedJson.contracts.incrementImpl.steps[0].changeset[0].val;
    expect(val).toBe("${document('counter') + event.request.value}");
  });
});
