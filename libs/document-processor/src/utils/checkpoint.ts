import { deepFreeze } from '@blue-labs/shared-utils';
import { DocumentNode } from '../types';
import { collectEmbeddedPaths, ENABLE_IMMUTABILITY } from './document';
import { isDocumentNode } from './typeGuard';
import { Blue, BlueNodeTypeSchema } from '@blue-labs/language';
import {
  blueIds,
  ChannelEventCheckpointSchema,
} from '@blue-repository/core-dev';

export function ensureCheckpointContracts(doc: DocumentNode, blue: Blue) {
  const cloned = doc.clone();

  // helper that mutates a node in-place (clone already done)
  const ensureOnNode = (node: DocumentNode): void => {
    if (!isDocumentNode(node)) return;

    const contracts = node.getContracts();

    if (!contracts) {
      return;
    }

    if (
      !contracts.checkpoint ||
      !BlueNodeTypeSchema.isTypeOf(
        contracts.checkpoint,
        ChannelEventCheckpointSchema
      )
    ) {
      node.addContract(
        'checkpoint',
        blue.jsonValueToNode({
          type: {
            name: 'Channel Event Checkpoint',
            blueId: blueIds['Channel Event Checkpoint'],
          },
          lastEvents: {},
        })
      );
    }
  };

  // 1️⃣ root
  ensureOnNode(cloned);

  // 2️⃣ every embedded document referenced by Process Embedded
  for (const { absPath } of collectEmbeddedPaths(cloned, blue)) {
    const embedded = cloned.get(absPath);
    if (isDocumentNode(embedded)) {
      ensureOnNode(embedded);
    }
  }

  return ENABLE_IMMUTABILITY ? deepFreeze(cloned) : cloned;
}
