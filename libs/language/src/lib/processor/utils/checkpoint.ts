import { deepFreeze } from '../../../utils/deepFreeze';
import { DocumentNode } from '../types';
import { collectEmbeddedPaths, ENABLE_IMMUTABILITY } from './document';
import { isDocumentNode } from './typeGuard';
import { NodeDeserializer } from '../../model';
import { blueIds } from '../../../repo/core';

export function ensureCheckpointContracts(doc: DocumentNode) {
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
      contracts.checkpoint.getType()?.getBlueId() !==
        blueIds['Channel Event Checkpoint']
    ) {
      node.addContract(
        'checkpoint',
        NodeDeserializer.deserialize({
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
  for (const { absPath } of collectEmbeddedPaths(cloned)) {
    const embedded = cloned.get(absPath);
    if (isDocumentNode(embedded)) {
      ensureOnNode(embedded);
    }
  }

  return ENABLE_IMMUTABILITY ? deepFreeze(cloned) : cloned;
}
