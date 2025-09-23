import { describe, expect, test } from 'vitest';
import { Blue } from '@blue-labs/language';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { repository as myosRepository } from '@blue-repository/myos-dev';
import { NativeBlueDocumentProcessor } from '../NativeBlueDocumentProcessor';
import { GasBudgetExceededError } from '../utils/exceptions';

const blue = new Blue({ repositories: [coreRepository, myosRepository] });

const documentDefinition = {
  contracts: {
    channelName: {
      type: 'MyOS Timeline Channel',
      timelineId: 'timeline-1',
    },
    counterWorkflow: {
      type: 'Sequential Workflow',
      channel: 'channelName',
      steps: [
        {
          name: 'EmitEvent',
          type: 'JavaScript Code',
          code: `return { events: event.message && event.message.name === 'Start' ? [{ name: 'X' }] : [] };`,
        },
      ],
    },
  },
} as const;

const timelineEvent = blue.resolve(
  blue.jsonValueToNode({
    type: 'MyOS Timeline Entry',
    timeline: {
      timelineId: 'timeline-1',
    },
    message: { name: 'Start' },
    timestamp: 1749540750150,
  })
);

const createInitializedState = async () => {
  const documentProcessor = new NativeBlueDocumentProcessor(blue);
  const documentNode = blue.jsonValueToNode(documentDefinition);
  const { state } = await documentProcessor.initialize(documentNode);
  return { documentProcessor, state };
};

describe('gas budget enforcement', () => {
  test('fails once gas budget is exhausted and succeeds with sufficient budget', async () => {
    const { documentProcessor: baselineProcessor, state: baselineState } =
      await createInitializedState();

    const baselineResult = await baselineProcessor.processEvents(
      baselineState,
      [timelineEvent],
      { gasBudget: 10_000 }
    );

    const gasUsed = baselineResult.gasUsed ?? 0;
    expect(gasUsed).toBe(385);

    const { documentProcessor: failingProcessor, state: failingState } =
      await createInitializedState();

    const failingBudget = Math.max(0, gasUsed - 1);

    await expect(
      failingProcessor.processEvents(failingState, [timelineEvent], {
        gasBudget: failingBudget,
      })
    ).rejects.toBeInstanceOf(GasBudgetExceededError);

    const { documentProcessor: succeedingProcessor, state: succeedingState } =
      await createInitializedState();

    const succeedingResult = await succeedingProcessor.processEvents(
      succeedingState,
      [timelineEvent],
      { gasBudget: gasUsed }
    );

    expect(succeedingResult.gasUsed).toBe(gasUsed);
    expect(succeedingResult.emitted).toHaveLength(1);
  });
});
