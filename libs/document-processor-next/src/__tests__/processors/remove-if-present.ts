import type { HandlerProcessor } from '../../registry/types.js';
import { removeIfPresentSchema, type RemoveIfPresent } from '../models/index.js';

export class RemoveIfPresentContractProcessor implements HandlerProcessor<RemoveIfPresent> {
  readonly kind = 'handler' as const;
  readonly blueIds = ['RemoveIfPresent'] as const;
  readonly schema = removeIfPresentSchema;

  execute(contract: RemoveIfPresent, context: Parameters<HandlerProcessor<RemoveIfPresent>['execute']>[1]): void {
    const key = contract.propertyKey;
    if (!key) return;
    const trimmed = key.trim();
    if (!trimmed) return;
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const pointer = context.resolvePointer(normalized);
    if (!context.documentContains(pointer)) return;
    context.applyPatch({ op: 'REMOVE', path: pointer });
  }
}


