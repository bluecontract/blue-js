import type {
  ChannelProcessor,
  ChannelEvaluationContext,
} from '../../registry/types.js';
import {
  testEventChannelSchema,
  type TestEventChannel,
  testEventSchema,
} from '../models/index.js';

const DEFAULT_EVENT_TYPE = 'TestEvent';

export class TestEventChannelProcessor implements ChannelProcessor<TestEventChannel> {
  readonly kind = 'channel' as const;
  readonly blueIds = ['TestEventChannel'] as const;
  readonly schema = testEventChannelSchema;

  matches(
    contract: TestEventChannel,
    context: ChannelEvaluationContext,
  ): boolean {
    const blue = context.blue;
    if (!context.event || !blue.isTypeOf(context.event, testEventSchema)) {
      return false;
    }
    const expectedType = contract.eventType ?? DEFAULT_EVENT_TYPE;
    return blue.isTypeOfBlueId(context.event, expectedType);
  }
}
