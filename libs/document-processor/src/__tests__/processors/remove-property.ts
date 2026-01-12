import type { HandlerProcessor } from '../../registry/types.js';
import { removePropertySchema, type RemoveProperty } from '../models/index.js';

export class RemovePropertyContractProcessor implements HandlerProcessor<RemoveProperty> {
  readonly kind = 'handler' as const;
  readonly blueIds = ['RemoveProperty'] as const;
  readonly schema = removePropertySchema;

  async execute(
    contract: RemoveProperty,
    context: Parameters<HandlerProcessor<RemoveProperty>['execute']>[1],
  ): Promise<void> {
    const propertyKey = contract.propertyKey;
    if (!propertyKey || propertyKey.trim().length === 0) {
      throw new Error('propertyKey must not be empty for RemoveProperty');
    }
    const normalized = this.normalize(propertyKey);
    const pointer = context.resolvePointer(normalized);
    await context.applyPatch({ op: 'REMOVE', path: pointer });
  }

  private normalize(key: string): string {
    let stripped = key.trim();
    if (!stripped.startsWith('/')) stripped = `/${stripped}`;
    return stripped.replace(/\/+/, '/');
  }
}
