import { BlueNode } from '@blue-labs/language';
import type { Operation } from '@blue-repository/types/packages/conversation/schemas/Operation';

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
): string | null {
  const documentNode = eventNode.getProperties()?.document;
  if (!(documentNode instanceof BlueNode)) {
    return null;
  }
  const blueId = documentNode.getBlueId?.();
  return typeof blueId === 'string' && blueId.length > 0 ? blueId : null;
}
