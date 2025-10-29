import { describe, expect, it } from 'vitest';
import { BlueNode } from '@blue-labs/language';

import { createBlue } from '../../test-support/blue.js';
import {
  buildProcessor,
  expectOk,
  property,
  typeBlueId,
} from '../../__tests__/test-utils.js';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';

const blue = createBlue();

function timelineEntryEvent(
  timelineId: string,
  messageType: 'Chat Message' | 'Request',
  overrides?: { message?: string; requestId?: string }
): BlueNode {
  const message =
    overrides?.message ??
    (messageType === 'Chat Message' ? 'New message' : 'Request payload');
  const requestId = overrides?.requestId ?? 'req-123';
  const messageFields =
    messageType === 'Chat Message'
      ? `  message: ${message}\n`
      : `  requestId: ${requestId}\n`;

  const yaml = `type: Timeline Entry
timeline:
  timelineId: ${timelineId}
message:
  type: ${messageType}
${messageFields}actor:
  name: Timeline Owner
timestamp: 1700000000
`;

  return blue.yamlToNode(yaml);
}

function initializeDocument(options?: {
  eventType?: 'Chat Message' | 'Request';
}): { processor: ReturnType<typeof buildProcessor>; initialized: BlueNode } {
  const processor = buildProcessor(blue);
  const eventSnippet = options?.eventType
    ? `    event:
      type: ${options.eventType}
`
    : '';

  const yaml = `name: Sequential Workflow Document
contracts:
  timelineChannel:
    type: Timeline Channel
    timelineId: alice
  emitNotification:
    type: Sequential Workflow
    channel: timelineChannel
${eventSnippet}    steps:
      - name: EmitGreeting
        type: Trigger Event
        event:
          type: Chat Message
          message: Workflow says hi
`;

  const initialized = expectOk(
    processor.initializeDocument(blue.yamlToNode(yaml))
  ).document;

  return { processor, initialized };
}

describe('SequentialWorkflowHandlerProcessor', () => {
  it('emits events defined by Trigger Event steps', () => {
    const { processor, initialized } = initializeDocument();

    const result = expectOk(
      processor.processDocument(
        initialized.clone(),
        timelineEntryEvent('alice', 'Chat Message', { message: 'hello' })
      )
    );

    expect(result.triggeredEvents).toHaveLength(1);
    const emitted = result.triggeredEvents[0];
    expect(typeBlueId(emitted)).toBe(conversationBlueIds['Chat Message']);
    const emittedMessage = property(emitted, 'message').getValue();
    expect(emittedMessage).toBe('Workflow says hi');
  });

  it('respects event filters when provided', () => {
    const { processor, initialized } = initializeDocument({
      eventType: 'Chat Message',
    });

    const matching = expectOk(
      processor.processDocument(
        initialized.clone(),
        timelineEntryEvent('alice', 'Chat Message', { message: 'eligible' })
      )
    );

    expect(matching.triggeredEvents).toHaveLength(1);

    const nonMatching = expectOk(
      processor.processDocument(
        matching.document.clone(),
        timelineEntryEvent('alice', 'Request', { requestId: 'ignore-me' })
      )
    );

    expect(nonMatching.triggeredEvents).toHaveLength(0);
  });
});
