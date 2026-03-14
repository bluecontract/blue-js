import type { BlueContract, BlueTypeInput, BlueValue } from '../../types.js';
import { resolveTypeInput } from '../../internal/type-resolver.js';
import { createOrderedObject } from '../../internal/order.js';

export const createChannelContract = (
  channelType: BlueTypeInput,
  rest: Record<string, BlueValue>,
): BlueContract =>
  createOrderedObject([
    ['type', resolveTypeInput(channelType) as BlueValue],
    ...Object.entries(rest),
  ]);

export const createCompositeChannelContract = (
  channels: string[],
): BlueContract =>
  createOrderedObject([
    ['type', 'Conversation/Composite Timeline Channel'],
    ['channels', channels],
  ]);
