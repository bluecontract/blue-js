import { ZodTypeAny } from 'zod';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';
import { BlueIdResolver } from './BlueIdResolver';
import { BlueNode } from '../model/Node';
import { BlueIdCalculator } from './BlueIdCalculator';

export class TypeSchemaResolver {
  private readonly blueIdMap = new Map<string, ZodTypeAny>();

  constructor(schemas: ZodTypeAny[]) {
    for (const schema of schemas) {
      this.registerSchema(schema);
    }
  }

  private registerSchema(schema: ZodTypeAny) {
    const blueId = BlueIdResolver.resolveBlueId(schema);

    if (isNonNullable(blueId)) {
      if (this.blueIdMap.has(blueId)) {
        throw new Error(`Duplicate BlueId value: ${blueId}`);
      }
      this.blueIdMap.set(blueId, schema);
    }
  }

  public resolveSchema(node: BlueNode) {
    const blueId = this.getEffectiveBlueId(node);
    if (isNullable(blueId)) {
      return null;
    }
    return this.blueIdMap.get(blueId);
  }

  private getEffectiveBlueId(node: BlueNode) {
    const nodeType = node.getType();
    if (isNonNullable(nodeType) && isNonNullable(nodeType.getBlueId())) {
      return nodeType.getBlueId();
    } else if (isNonNullable(nodeType)) {
      return BlueIdCalculator.calculateBlueIdSync(nodeType);
    }
    return null;
  }

  public getBlueIdMap() {
    return new Map(this.blueIdMap);
  }
}
