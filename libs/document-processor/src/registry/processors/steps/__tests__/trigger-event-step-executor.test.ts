import { describe, expect, it } from 'vitest';

import { createBlue } from '../../../../test-support/blue.js';
import {
  createArgs,
  createRealContext,
} from '../../../../test-support/workflow.js';
import { TriggerEventStepExecutor } from '../trigger-event-step-executor.js';
import { ProcessorFatalError } from '../../../../engine/processor-fatal-error.js';
import { blueIds as conversationBlueIds } from '@blue-repository/conversation';
import { typeBlueId } from '../../../../__tests__/test-utils.js';

describe('TriggerEventStepExecutor', () => {
  const executor = new TriggerEventStepExecutor();

  it('emits the provided event payload', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Trigger Event
event:
  type: Chat Message
  message: Hello World
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await executor.execute(args);

    const emissions = setup.execution.runtime().rootEmissions();
    expect(emissions).toHaveLength(1);
    const emitted = emissions[0];
    expect(typeBlueId(emitted)).toBe(conversationBlueIds['Chat Message']);
    const message = emitted.getProperties()?.message?.getValue();
    expect(message).toBe('Hello World');
  });

  it('throws a fatal error when the step schema is invalid', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: JavaScript Code
code: return 1;
`);
    const eventNode = blue.jsonValueToNode({});
    const setup = createRealContext(blue, eventNode);
    const args = createArgs({ context: setup.context, stepNode, eventNode });

    await expect(executor.execute(args)).rejects.toThrow(ProcessorFatalError);
  });

  it('throws a fatal error when event payload is missing', async () => {
    const blue = createBlue();
    const stepNode = blue.yamlToNode(`type: Trigger Event
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
    const stepNode = blue.yamlToNode(`type: Trigger Event
event:
  type: Chat Message
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
    expect(typeBlueId(emitted)).toBe(conversationBlueIds['Chat Message']);

    const message = emitted.getProperties()?.message?.getValue();
    expect(message).toBe('Subscription renewal for 125 USD');
  });
});
