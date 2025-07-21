import { Blue } from '@blue-labs/language';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { prepareToProcessYaml } from '../testUtils';
import { createTimelineEntryEvent } from '../utils/eventFactories';

describe('BlueDocumentProcessor', () => {
  const blue = new Blue({
    repositories: [coreRepository, myosRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);
  const timelineEntryEvent = (timelineId: string, message: unknown) => {
    return createTimelineEntryEvent(timelineId, message, blue);
  };

  it('creates subscriptions to agents based on timeline event', async () => {
    const docyaml = `
name: Agent Subscription Creator
receivedEvent:
  description: List of received events
  type: List
  items: []
contracts:
  ownerChannel:
    type: MyOS Timeline Channel
    timelineId: test-timeline

  createSubscriptionWorkflow:
    type: Sequential Workflow
    channel: ownerChannel
    event:
      type: Agent Subscription Request
    steps:
      - name: CreateSubscriptions
        type: JavaScript Code
        code: |
          const changes = [];

          event.message.subscriptions.forEach((sub, idx) => {
            const channelName = \`agent\${idx + 1}Channel\`;
            const workflowName = \`appendEventWorkflow\${idx + 1}\`;

            changes.push({
              op: "add",
              path: \`/contracts/\${channelName}\`,
              val: {
                type: "MyOS Agent Channel",
                agent: { agentId: sub.agentId },
                event: { type: sub.eventType }
              }
            });

            changes.push({
              op: "add",
              path: \`/contracts/\${workflowName}\`,
              val: {
                type: "Sequential Workflow",
                channel: channelName,
                steps: [
                  {
                    name: "AppendEvent",
                    type: "Update Document",
                    changeset: [
                      {
                        op: "add",
                        path: "/receivedEvent/items/-",
                        val: "\${event}"
                      }
                    ]
                  },
                  {
                    name: "EmitEvent",
                    type: "JavaScript Code",
                    code: "return { events: [{ type: event.event.type + 'a'}] };"
                  }
                ]
              }
            });
          });

          return { changes };
      - name: UpdateContracts
        type: Update Document
        changeset: 
          type: List
          itemType: Json Patch Entry
          value: "\${steps.CreateSubscriptions.changes}"`;

    const { initializedState } = await prepareToProcessYaml(docyaml, {
      blue,
      documentProcessor,
    });

    const event = timelineEntryEvent('test-timeline', {
      type: 'Agent Subscription Request',
      subscriptions: [
        {
          agentId: 'agent-1',
          eventType: 'EventType1',
        },
        {
          agentId: 'agent-2',
          eventType: 'EventType2',
        },
      ],
    });

    const { state } = await documentProcessor.processEvents(initializedState, [
      event,
    ]);
    const data = blue.nodeToJson(state, 'simple') as any;

    expect(data.contracts).toMatchObject({
      agent1Channel: {
        agent: { agentId: 'agent-1' },
        event: { type: 'EventType1' },
      },
    });
  });
});
