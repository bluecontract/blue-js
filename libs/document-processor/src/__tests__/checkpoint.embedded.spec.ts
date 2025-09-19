import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { EventNodePayload } from '../types';
import { JsonObject } from '@blue-labs/shared-utils';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';
import { prepareToProcess } from '../testUtils';
import { createTimelineEntryEvent } from '../utils/eventFactories';

describe('Checkpoint – embedded documents via Process Embedded', () => {
  const blue = new Blue({
    repositories: [coreRepository],
  });
  const documentProcessor = new BlueDocumentProcessor(blue);

  const doc: JsonObject = {
    contracts: {
      embedder: {
        type: 'Process Embedded',
        paths: ['/order'],
      },
      orderUpdatesRoot: {
        type: 'Timeline Channel',
        timelineId: 'orders',
      },
    },
    order: {
      contracts: {
        orderUpdates: {
          type: 'Timeline Channel',
          timelineId: 'orders',
        },
      },
    },
  };

  const payload: EventNodePayload = createTimelineEntryEvent(
    'orders',
    null,
    blue
  );

  it('writes checkpoints in BOTH root and embedded docs', async () => {
    const { initializedState } = await prepareToProcess(doc, {
      blue,
      documentProcessor,
    });
    const { state } = await documentProcessor.processEvents(initializedState, [
      payload,
    ]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    const orderUpdatesRootBlueId =
      jsonState.contracts.checkpoint.lastEvents.orderUpdatesRoot.blueId;
    const orderUpdatesBlueId =
      jsonState.order.contracts.checkpoint.lastEvents.orderUpdates.blueId;

    expect(orderUpdatesRootBlueId).toBe(orderUpdatesBlueId);
  });
});
