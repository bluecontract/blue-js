import type { JsonObject } from '../core/types.js';

function requireChannelKey(channelKey: string): string {
  const normalized = channelKey.trim();
  if (normalized.length === 0) {
    throw new Error('channelKey is required');
  }
  return normalized;
}

function fromParentField(
  channelKey: string,
  field: 'accountId' | 'email',
): JsonObject {
  const key = requireChannelKey(channelKey);
  return {
    [field]: "${document('/contracts/" + key + '/' + field + "')}",
  };
}

export function fromChannel(channelKey: string): JsonObject {
  return fromParentField(channelKey, 'accountId');
}

export function fromEmail(channelKey: string): JsonObject {
  return fromParentField(channelKey, 'email');
}
