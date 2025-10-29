import type { HandlerProcessor } from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import {
  incrementPropertySchema,
  type IncrementProperty,
} from '../models/index.js';

export class IncrementPropertyContractProcessor
  implements HandlerProcessor<IncrementProperty>
{
  readonly kind = 'handler' as const;
  readonly blueIds = ['IncrementProperty'] as const;
  readonly schema = incrementPropertySchema;

  execute(
    contract: IncrementProperty,
    context: Parameters<HandlerProcessor<IncrementProperty>['execute']>[1],
  ): void {
    const pointer = this.buildPointer(contract.propertyKey);
    const absolute = context.resolvePointer(pointer);
    const existing = context.documentAt(absolute);

    const current = Number(existing?.getValue() ?? 0);
    const next = current + 1;
    const valueNode = new BlueNode().setValue(next);
    const exists = context.documentContains(absolute);
    const op = exists ? 'REPLACE' : 'ADD';
    context.applyPatch({ op, path: absolute, val: valueNode });
  }

  private buildPointer(key: string): string {
    if (!key || key.trim().length === 0) {
      throw new Error('propertyKey must not be empty');
    }
    let stripped = key.trim().replace(/\/+/, '/');
    while (stripped.startsWith('/')) stripped = stripped.substring(1);
    while (stripped.endsWith('/'))
      stripped = stripped.substring(0, stripped.length - 1);
    return `/${stripped}`;
  }
}
