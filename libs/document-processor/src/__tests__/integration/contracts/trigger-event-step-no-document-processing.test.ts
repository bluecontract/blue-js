import { describe, expect, it } from 'vitest';
import { createBlue } from '../../../test-support/blue.js';
import { buildProcessor, expectOk, typeBlueId } from '../../test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';

const blue = createBlue();

describe('Trigger Event step — does not process embedded document payload', () => {
  it('emits events when Trigger Event contains nested document without processing it', async () => {
    const processor = buildProcessor(blue);
    const documentYaml = `name: Trigger Event Nested Document
contracts:
  timeline:
    type: Timeline Channel
    timelineId: admin
  triggered:
    type: Triggered Event Channel
  onTimeline:
    type: Sequential Workflow
    channel: timeline
    event:
      type: Chat Message
    steps:
      - name: EmitStart
        type: Trigger Event
        event:
          type: Chat Message
          message: start
          document:
            name: Child Worker Session
            contracts:
              nestedTimeline:
                type: Timeline Channel
                timelineId: child
              nestedWorkflow:
                type: Sequential Workflow
                channel: nestedTimeline
                steps: []
`;

    const initialized = await expectOk(
      processor.initializeDocument(blue.yamlToNode(documentYaml)),
    );

    const externalTimelineEvent = blue.jsonValueToNode({
      type: 'Timeline Entry',
      timeline: { timelineId: 'admin' },
      message: { type: 'Chat Message', message: 'hello' },
    });

    const processed = await expectOk(
      processor.processDocument(
        initialized.document.clone(),
        externalTimelineEvent,
      ),
    );

    // The Trigger Event step should emit at least one event,
    // and the nested "document" payload must not be processed as a document.
    expect(processed.triggeredEvents.length).toBeGreaterThan(0);

    const chatEvents = processed.triggeredEvents.filter(
      (e) => typeBlueId(e) === conversationBlueIds['Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
  });
});
