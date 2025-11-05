import type { HandlerProcessor } from '../../registry/types.js';
import { emitEventsSchema, type EmitEvents } from '../models/index.js';

function shouldEmit(
  contract: EmitEvents,
  event: Parameters<HandlerProcessor<EmitEvents>['execute']>[1]['event'],
): boolean {
  const current = event();
  if (!contract.expectedKind) return true;
  const kindNode = current?.getProperties()?.kind;
  const value = kindNode?.getValue();
  return value != null && String(value) === contract.expectedKind;
}

export class EmitEventsContractProcessor
  implements HandlerProcessor<EmitEvents>
{
  readonly kind = 'handler' as const;
  readonly blueIds = ['EmitEvents'] as const;
  readonly schema = emitEventsSchema;

  execute(
    contract: EmitEvents,
    context: Parameters<HandlerProcessor<EmitEvents>['execute']>[1],
  ): void {
    if (!contract.events || contract.events.length === 0) return;
    if (!shouldEmit(contract, context.event.bind(context))) return;
    for (const e of contract.events) {
      if (e) {
        context.emitEvent(e.clone());
      }
    }
  }
}
