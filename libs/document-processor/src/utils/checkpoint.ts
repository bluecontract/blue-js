import { DocumentNode } from '../types';
import { collectEmbeddedPathSpecs, freeze, mutable } from './document';
import { isDocumentNode } from './typeGuard';
import { Blue, BlueNodeTypeSchema } from '@blue-labs/language';
import {
  blueIds,
  ChannelEventCheckpointSchema,
} from '@blue-repository/core-dev';

export function ensureCheckpointContracts(doc: DocumentNode, blue: Blue) {
  const mutableDoc = mutable(doc);

  // helper that mutates a node in-place (clone already done)
  const ensureOnNode = (node: DocumentNode): void => {
    if (!isDocumentNode(node)) return;

    const contracts = node.getContracts();

    if (
      !contracts?.checkpoint ||
      !BlueNodeTypeSchema.isTypeOf(
        contracts.checkpoint,
        ChannelEventCheckpointSchema,
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
        }),
      );
    }
  };

  // 1️⃣ root
  ensureOnNode(mutableDoc);

  // 2️⃣ every embedded document referenced by Process Embedded
  for (const { absPath } of collectEmbeddedPathSpecs(mutableDoc, blue)) {
    const embedded = mutableDoc.get(absPath);
    if (isDocumentNode(embedded)) {
      ensureOnNode(embedded);
    }
  }

  return freeze(mutableDoc);
}
