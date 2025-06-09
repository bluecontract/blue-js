import { describe, it, expect } from 'vitest';
import { Blue } from '@blue-labs/language';
import { EventNodePayload } from '../types';
import { JsonObject } from '@blue-labs/shared-utils';
import { BlueDocumentProcessor } from '../BlueDocumentProcessor';
import { repository as coreRepository } from '@blue-repository/core-dev';

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
        type: 'Document Update Channel',
        path: '/order/total',
      },
    },
    order: {
      contracts: {
        orderUpdates: {
          type: 'Document Update Channel',
          path: '/total',
        },
      },
      total: 10,
    },
  };
  const docNode = blue.jsonValueToNode(doc);

  const payload: EventNodePayload = {
    type: 'Document Update',
    op: 'replace',
    path: '/order/total',
    val: 15,
  };

  it('writes checkpoints in BOTH root and embedded docs', async () => {
    const { state } = await documentProcessor.processEvents(docNode, [payload]);

    const jsonState = blue.nodeToJson(state, 'simple') as any;

    const orderUpdatesRootBlueId =
      jsonState.contracts.checkpoint.lastEvents.orderUpdatesRoot.blueId;
    const orderUpdatesBlueId =
      jsonState.order.contracts.checkpoint.lastEvents.orderUpdates.blueId;

    expect(orderUpdatesRootBlueId).toBe(orderUpdatesBlueId);
  });
});
