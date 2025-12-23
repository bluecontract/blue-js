import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../../test-support/blue.js';
import {
  createArgs,
  createRealContext,
} from '../../../../test-support/workflow.js';
import { TriggerEventStepExecutor } from '../trigger-event-step-executor.js';
import { ProcessorFatalError } from '../../../../engine/processor-fatal-error.js';
import { blueIds as conversationBlueIds } from '@blue-repository/types/packages/conversation/blue-ids';
import { property, typeBlueId } from '../../../../__tests__/test-utils.js';

describe('TriggerEventStepExecutor', () => {
  const executor = new TriggerEventStepExecutor();

  it('emits the provided event payload', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Trigger Event
event:
  type: Conversation/Chat Message
  message: Hello World
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const emissions = setup.execution.runtime().rootEmissions();
    expect(emissions).toHaveLength(1);
    const emitted = emissions[0];
    expect(typeBlueId(emitted)).toBe(
      conversationBlueIds['Conversation/Chat Message'],
    );
    const message = emitted.getProperties()?.message?.getValue();
    expect(message).toBe('Hello World');
  });

  it('throws a fatal error when the step schema is invalid', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/JavaScript Code
code: return 1;
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(ProcessorFatalError);
  });

  it('throws a fatal error when event payload is missing', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Conversation/Trigger Event
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(ProcessorFatalError);
  });

  it('resolves expressions within the event payload', async () => {
    const blue = createBlue();
    const messageTemplate =
      "${steps.PreparePayment.description} for ${steps.PreparePayment.amount} ${document('/currency')}";
    const stepNode = blue.yamlToNode(`type: Conversation/Trigger Event
event:
  type: Conversation/Chat Message
  message: ${JSON.stringify(messageTemplate)}
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    setup.execution
      .runtime()
      .directWrite('/currency', blue.jsonValueToNode('USD'));

    const args = createArgs({
      context: setup.context,
      stepNode,
      eventNode,
      stepResults: {
        PreparePayment: {
          amount: 125,
          description: 'Subscription renewal',
        },
      },
    });

    await executor.execute(args);

    const emissions = setup.execution.runtime().rootEmissions();
    expect(emissions).toHaveLength(1);
    const emitted = emissions[0];
    expect(typeBlueId(emitted)).toBe(
      conversationBlueIds['Conversation/Chat Message'],
    );

    const message = emitted.getProperties()?.message?.getValue();
    expect(message).toBe('Subscription renewal for 125 USD');
  });

  it('keeps nested documents inside the event payload as literal data', async () => {
    const blue = createBlue();
    const messageTemplate = 'Launching ${steps.Prepare.name}';
    const stepNode = blue.yamlToNode(`type: Conversation/Trigger Event
event:
  type: Conversation/Chat Message
  message: ${JSON.stringify(messageTemplate)}
  document:
    name: Child Worker Session
    contracts:
      nestedTimeline:
        type: Conversation/Timeline Channel
        timelineId: child
      nestedWorkflow:
        type: Conversation/Sequential Workflow
        channel: nestedTimeline
        steps:
          - name: UpdateToken
            type: Conversation/Update Document
            changeset:
              - op: replace
                path: /token
                val: "\${steps.Prepare.secret}"
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({
      context: setup.context,
      stepNode,
      eventNode,
      stepResults: {
        Prepare: { name: 'Alpha', secret: 'shared-secret' },
      },
    });

    await executor.execute(args);

    const emissions = setup.execution.runtime().rootEmissions();
    expect(emissions).toHaveLength(1);
    const emitted = emissions[0];

    const message = property(emitted, 'message').getValue();
    expect(message).toBe('Launching Alpha');

    const nestedDocument = property(emitted, 'document');
    const nestedJson = blue.nodeToJson(nestedDocument, 'original') as {
      contracts: {
        nestedWorkflow: {
          steps: Array<{ changeset: Array<{ val: string }> }>;
        };
      };
    };

    const val = nestedJson.contracts.nestedWorkflow.steps[0].changeset[0].val;
    expect(val).toBe('${steps.Prepare.secret}');
  });
});
