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
  overrides?: { message?: string; requestId?: string },
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

async function initializeDocument(options?: {
  eventType?: 'Chat Message' | 'Request';
}): Promise<{
  processor: ReturnType<typeof buildProcessor>;
  initialized: BlueNode;
}> {
  const processor = buildProcessor(blue);
  const eventSnippet = options?.eventType
    ? `    event:
      message:
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

  const initializedResult = await expectOk(
    processor.initializeDocument(blue.yamlToNode(yaml)),
  );

  return { processor, initialized: initializedResult.document };
}

describe('SequentialWorkflowHandlerProcessor', () => {
  it('emits events defined by Trigger Event steps', async () => {
    const { processor, initialized } = await initializeDocument();

    const result = await expectOk(
      processor.processDocument(
        initialized.clone(),
        timelineEntryEvent('alice', 'Chat Message', { message: 'hello' }),
      ),
    );

    expect(result.triggeredEvents).toHaveLength(1);
    const emitted = result.triggeredEvents[0];
    expect(typeBlueId(emitted)).toBe(conversationBlueIds['Chat Message']);
    const emittedMessage = property(emitted, 'message').getValue();
    expect(emittedMessage).toBe('Workflow says hi');
  });

  it('respects event filters when provided', async () => {
    const { processor, initialized } = await initializeDocument({
      eventType: 'Chat Message',
    });

    const matching = await expectOk(
      processor.processDocument(
        initialized.clone(),
        timelineEntryEvent('alice', 'Chat Message', { message: 'eligible' }),
      ),
    );

    expect(matching.triggeredEvents).toHaveLength(1);

    const nonMatching = await expectOk(
      processor.processDocument(
        matching.document.clone(),
        timelineEntryEvent('alice', 'Request', { requestId: 'ignore-me' }),
      ),
    );

    expect(nonMatching.triggeredEvents).toHaveLength(0);
  });

  it('runs for all channel-matched events when no event filter is provided', async () => {
    const { processor, initialized } = await initializeDocument();

    // Chat Message matches the Timeline Channel and should trigger the workflow
    const chatResult = await expectOk(
      processor.processDocument(
        initialized.clone(),
        timelineEntryEvent('alice', 'Chat Message', { message: 'eligible' }),
      ),
    );
    expect(chatResult.triggeredEvents).toHaveLength(1);

    // Request also matches the same channel and should trigger as well when no event filter is set
    const requestResult = await expectOk(
      processor.processDocument(
        chatResult.document.clone(),
        timelineEntryEvent('alice', 'Request', { requestId: 'accept-me' }),
      ),
    );
    expect(requestResult.triggeredEvents).toHaveLength(1);
  });

  it('requires events to satisfy both channel and workflow filters', async () => {
    const processor = buildProcessor(blue);
    const documentYaml = `name: Sequential Workflow With Combined Filters
contracts:
  timelineChannel:
    type: Timeline Channel
    timelineId: alice
    event:
      message:
        type: Chat Message
  emitNotification:
    type: Sequential Workflow
    channel: timelineChannel
    event:
      message:
        message: eligible
    steps:
      - name: EmitGreeting
        type: Trigger Event
        event:
          type: Chat Message
          message: Workflow says hi
`;

    const initializedResult = await expectOk(
      processor.initializeDocument(blue.yamlToNode(documentYaml)),
    );
    const initialized = initializedResult.document;

    const matchingEvent = timelineEntryEvent('alice', 'Chat Message', {
      message: 'eligible',
    });
    const afterMatching = await expectOk(
      processor.processDocument(initialized.clone(), matchingEvent),
    );
    expect(afterMatching.triggeredEvents).toHaveLength(1);

    const nonMatchingEvent = timelineEntryEvent('alice', 'Chat Message', {
      message: 'ignored',
    });
    const afterNonMatching = await expectOk(
      processor.processDocument(
        afterMatching.document.clone(),
        nonMatchingEvent,
      ),
    );
    expect(afterNonMatching.triggeredEvents).toHaveLength(0);
  });
});
