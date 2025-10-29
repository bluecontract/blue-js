import type { HandlerProcessor } from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import {
  setPropertyOnEventSchema,
  type SetPropertyOnEvent,
} from '../models/index.js';

function matchesEvent(
  contract: SetPropertyOnEvent,
  event: ReturnType<
    Parameters<HandlerProcessor<SetPropertyOnEvent>['execute']>[1]['event']
  >,
): boolean {
  if (!event?.getProperties()) return false;
  if (!contract.expectedKind || contract.expectedKind.length === 0) return true;
  const kindNode = event.getProperties()?.kind;
  const value = kindNode?.getValue();
  return value != null && String(value) === contract.expectedKind;
}

export class SetPropertyOnEventContractProcessor
  implements HandlerProcessor<SetPropertyOnEvent>
{
  readonly kind = 'handler' as const;
  readonly blueIds = ['SetPropertyOnEvent'] as const;
  readonly schema = setPropertyOnEventSchema;

  execute(
    contract: SetPropertyOnEvent,
    context: Parameters<HandlerProcessor<SetPropertyOnEvent>['execute']>[1],
  ): void {
    const event = context.event();
    if (!matchesEvent(contract, event)) return;
    const valueNode = new BlueNode().setValue(contract.propertyValue);
    const pointer = context.resolvePointer(contract.propertyKey);
    context.applyPatch({ op: 'ADD', path: pointer, val: valueNode });
  }
}
