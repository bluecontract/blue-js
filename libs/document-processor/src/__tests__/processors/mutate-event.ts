import type { HandlerProcessor } from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import { mutateEventSchema, type MutateEvent } from '../models/index.js';

export class MutateEventContractProcessor implements HandlerProcessor<MutateEvent> {
  readonly kind = 'handler' as const;
  readonly blueIds = ['MutateEvent'] as const;
  readonly schema = mutateEventSchema;

  execute(
    _contract: MutateEvent,
    context: Parameters<HandlerProcessor<MutateEvent>['execute']>[1],
  ): void {
    const event = context.event();
    if (!event) return;
    const mutated = new BlueNode().setValue('mutated');
    event.setProperties({ ...(event.getProperties() ?? {}), kind: mutated });
  }
}
