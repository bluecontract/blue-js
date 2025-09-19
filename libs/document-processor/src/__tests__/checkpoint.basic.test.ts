import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Blue } from '@blue-labs/language';
import { EventNodePayload } from '../types';
import { JsonObject } from '@blue-labs/shared-utils';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { prepareToProcess } from '../testUtils';
import { createTimelineEntryEvent } from '../utils/eventFactories';

let seq = 0;

describe('Checkpoint – basic root-channel scenario', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);

  beforeEach(() => {
    seq = 0;
    vi.spyOn(blue, 'calculateBlueId').mockImplementation(async () => {
      seq++;
      return `blue-${seq}`;
    });
  });

  const doc: JsonObject = {
    contracts: {
      userUpdates: {
        type: 'Timeline Channel',
        timelineId: 'user-123',
      },
    },
  };

  const updateEvt: EventNodePayload = createTimelineEntryEvent(
    'user-123',
    null,
    blue
  );

  it('writes exactly one blueId for the channel after the batch', async () => {
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });
    const { state } = await documentProcessor.processEvents(initializedState, [
      updateEvt,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState.contracts.checkpoint.lastEvents.userUpdates.blueId).toBe(
      'blue-1'
    );
  });

  it('replaces the blueId on the next external event', async () => {
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });
    const firstBatch = await documentProcessor.processEvents(initializedState, [
      updateEvt,
    ]);
    const secondBatch = await documentProcessor.processEvents(
      firstBatch.state,
      [updateEvt]
    ); // second batch

    const jsonState = blue.nodeToJson(secondBatch.state, 'simple') as any;

    expect(jsonState.contracts.checkpoint.lastEvents.userUpdates.blueId).toBe(
      'blue-2'
    ); // incremented stub
  });
});
