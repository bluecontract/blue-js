import { BlueNode } from '@blue-labs/language';
import type { Operation } from '@blue-repository/conversation';

import type { ContractProcessorContext } from '../../types.js';

export function extractOperationChannelKey(
  operation: Operation,
): string | null {
  const channelKey = operation.channel;

  if (typeof channelKey === 'string') {
    const trimmed = channelKey.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
}

export function extractPinnedDocumentBlueId(
  eventNode: BlueNode,
  context: ContractProcessorContext,
): string | null {
  const documentNode = eventNode.getProperties()?.document;
  if (!(documentNode instanceof BlueNode)) {
    return null;
  }
  return context.blue.calculateBlueIdSync(documentNode);
}
