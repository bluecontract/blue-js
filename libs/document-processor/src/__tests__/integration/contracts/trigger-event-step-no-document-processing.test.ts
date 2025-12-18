import { describe, expect, it } from 'vitest';
import { createBlue } from '../../../test-support/blue.js';
import { buildProcessor, expectOk, typeBlueId } from '../../test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';

const blue = createBlue();

describe('Trigger Event step — does not process embedded document payload', () => {
  it('emits events when Trigger Event contains nested document without processing it', async () => {
    const processor = buildProcessor(blue);
    const documentYaml = `name: Trigger Event Nested Document
contracts:
  timeline:
    type: Conversation/Timeline Channel
    timelineId: admin
  triggered:
    type: Core/Triggered Event Channel
  onTimeline:
    type: Conversation/Sequential Workflow
    channel: timeline
    event:
      message:
        type: Conversation/Chat Message
    steps:
      - name: EmitStart
        type: Conversation/Trigger Event
        event:
          type: Conversation/Chat Message
          message: start
          document:
            name: Child Worker Session
            contracts:
              nestedTimeline:
                type: Conversation/Timeline Channel
                timelineId: child
              nestedWorkflow:
                type: Conversation/Sequential Workflow
                channel: nestedTimeline
                steps: []
`;

    const initialized = await expectOk(
      processor.initializeDocument(blue.yamlToNode(documentYaml)),
    );

    const externalTimelineEvent = blue.jsonValueToNode({
      type: 'Conversation/Timeline Entry',
      timeline: { timelineId: 'admin' },
      message: { type: 'Conversation/Chat Message', message: 'hello' },
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
      (e) => typeBlueId(e) === conversationBlueIds['Conversation/Chat Message'],
    );
    expect(chatEvents.length).toBe(1);
  });
});
