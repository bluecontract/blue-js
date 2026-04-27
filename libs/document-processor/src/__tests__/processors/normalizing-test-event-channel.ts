import type {
  ChannelProcessor,
  ChannelEvaluationContext,
} from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import {
  testEventChannelSchema,
  type TestEventChannel,
  testEventSchema,
} from '../models/index.js';

const DEFAULT_EVENT_TYPE = 'TestEvent';

export class NormalizingTestEventChannelProcessor implements ChannelProcessor<TestEventChannel> {
  static readonly NORMALIZED_KIND = 'channelized';
  readonly kind = 'channel' as const;
  readonly blueIds = ['TestEventChannel'] as const;
  readonly schema = testEventChannelSchema;

  matches(
    contract: TestEventChannel,
    context: ChannelEvaluationContext,
  ): boolean {
    const blue = context.blue;
    if (!context.event || !blue.isTypeOf(context.event, testEventSchema))
      return false;
    const expectedType = contract.eventType ?? DEFAULT_EVENT_TYPE;
    const ok = blue.isTypeOfBlueId(context.event, expectedType);
    if (!ok) return false;
    const event = context.event;
    if (event) {
      const nextKind = new BlueNode().setValue(
        NormalizingTestEventChannelProcessor.NORMALIZED_KIND,
      );
      event.setProperties({ ...(event.getProperties() ?? {}), kind: nextKind });
    }
    return true;
  }
}
