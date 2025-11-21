import type { HandlerProcessor } from '../../registry/types.js';
import { BlueNode } from '@blue-labs/language';
import { setPropertySchema, type SetProperty } from '../models/index.js';

export class SetPropertyContractProcessor implements HandlerProcessor<SetProperty> {
  readonly kind = 'handler' as const;
  readonly blueIds = ['SetProperty'] as const;
  readonly schema = setPropertySchema;

  async execute(
    contract: SetProperty,
    context: Parameters<HandlerProcessor<SetProperty>['execute']>[1],
  ): Promise<void> {
    const propertyKey = contract.propertyKey ?? 'x';
    const valueNode = new BlueNode().setValue(contract.propertyValue);
    const relativePointer = this.buildPointer(contract.path, propertyKey);
    const targetPath = context.resolvePointer(relativePointer);
    const exists = context.documentContains(targetPath);
    const op = exists ? 'REPLACE' : 'ADD';
    await context.applyPatch({ op, path: targetPath, val: valueNode });
  }

  private buildPointer(path: string | undefined, propertyKey: string): string {
    const base = this.strip(path);
    const key = this.strip(propertyKey);
    if (!base && !key) return '/';
    if (!base) return `/${key}`;
    if (!key) return `/${base}`;
    return `/${base}/${key}`;
  }

  private strip(value: string | undefined): string {
    if (!value || value.trim().length === 0) return '';
    let result = value.trim().replace(/\/+/, '/');
    while (result.startsWith('/')) result = result.substring(1);
    while (result.endsWith('/'))
      result = result.substring(0, result.length - 1);
    return result;
  }
}
