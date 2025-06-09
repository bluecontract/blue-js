import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Blue } from '@blue-labs/language';
import { EventNodePayload } from '../types';
import { JsonObject } from '@blue-labs/shared-utils';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';

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
        type: 'Document Update Channel',
        path: '/profile/username',
      },
    },
    profile: { username: 'old' },
  };
  const docNode = blue.jsonValueToNode(doc);

  const updateEvt: EventNodePayload = {
    type: 'Document Update',
    op: 'replace',
    path: '/profile/username',
    val: 'new',
  };

  it('writes exactly one blueId for the channel after the batch', async () => {
    const { state } = await documentProcessor.processEvents(docNode, [
      updateEvt,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    expect(jsonState.contracts.checkpoint.lastEvents.userUpdates.blueId).toBe(
      'blue-1'
    );
  });

  it('replaces the blueId on the next external event', async () => {
    const firstBatch = await documentProcessor.processEvents(docNode, [
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
