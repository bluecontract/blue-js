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
    return expectedType === this.resolveEventType(context.event ?? null);
  }

  private resolveEventType(event: BlueNode | null): string | null {
    if (!event) return null;
    const typeNode = event.getType?.();
    if (!typeNode) return null;
    const blueId = typeNode.getBlueId?.();
    if (blueId) return blueId;
    const props = typeNode.getProperties?.();
    const blueIdNode = props?.blueId;
    const value = blueIdNode?.getValue?.();
    return typeof value === 'string' ? value : null;
  }
}
