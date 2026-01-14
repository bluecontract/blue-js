import { BlueNode, isBigNumber } from '@blue-labs/language';

import type {
  ChannelEvaluationContext,
  ChannelProcessor,
} from '../../registry/types.js';
import {
  recencyTestChannelSchema,
  testEventSchema,
  type RecencyTestChannel,
} from '../models/index.js';

export class RecencyTestChannelProcessor implements ChannelProcessor<RecencyTestChannel> {
  readonly kind = 'channel' as const;
  readonly blueIds = ['RecencyTestChannel'] as const;
  readonly schema = recencyTestChannelSchema;

  matches(
    contract: RecencyTestChannel,
    context: ChannelEvaluationContext,
  ): boolean {
    void contract;
    const { event, blue } = context;
    if (!event || !blue.isTypeOf(event, testEventSchema)) {
      return false;
    }
    return true;
  }

  channelize(
    contract: RecencyTestChannel,
    context: ChannelEvaluationContext,
  ): BlueNode | null | undefined {
    void contract;
    const { event } = context;
    if (!event) {
      return null;
    }
    const props = event.getProperties() ?? {};
    const channelized = event.clone();
    channelized.setProperties({
      ...props,
      channelized: new BlueNode().setValue(true),
    });
    return channelized;
  }

  isNewerEvent(
    contract: RecencyTestChannel,
    context: ChannelEvaluationContext,
    lastEvent: BlueNode,
  ): boolean {
    const currentValue = toNumber(extractValue(context.event));
    const lastValue = toNumber(extractValue(lastEvent));
    if (currentValue == null || lastValue == null) {
      return true;
    }
    const minDelta =
      typeof contract.minDelta === 'number' ? contract.minDelta : 0;
    return currentValue >= lastValue + minDelta;
  }
}

function toNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (isBigNumber(value)) {
    return value.toNumber();
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractValue(node: BlueNode | null | undefined): unknown {
  if (!node) {
    return null;
  }
  const fromProps = node.getProperties()?.value?.getValue();
  if (fromProps != null) {
    return fromProps;
  }
  return node.getValue();
}
