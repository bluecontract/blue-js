import { ZodTypeAny } from 'zod';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';
import { BlueIdResolver } from './BlueIdResolver';
import { BlueNode } from '../model/Node';
import { BlueIdCalculator } from './BlueIdCalculator';
import { NodeProvider } from '../NodeProvider';
import { isSubtype } from './NodeTypes';

export class TypeSchemaResolver {
  private readonly blueIdMap = new Map<string, ZodTypeAny>();
  private nodeProvider: NodeProvider | null;

  constructor(
    schemas: ZodTypeAny[] = [],
    options?: { nodeProvider?: NodeProvider | null },
  ) {
    this.nodeProvider = options?.nodeProvider ?? null;
    this.registerSchemas(schemas);
  }

  public registerSchemas(schemas: ZodTypeAny[]) {
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

  public setNodeProvider(nodeProvider: NodeProvider | null) {
    this.nodeProvider = nodeProvider;
  }

  public resolveSchema(node: BlueNode) {
    const blueId = this.getEffectiveBlueId(node);
    if (isNullable(blueId)) {
      return null;
    }
    return this.blueIdMap.get(blueId);
  }

  public isSchemaExtendedFrom(
    extendedSchema: ZodTypeAny | null | undefined,
    baseSchema: ZodTypeAny,
  ): boolean {
    if (isNullable(extendedSchema)) {
      return false;
    }

    const extendedBlueId = this.getBlueIdForSchema(extendedSchema);
    const baseBlueId = this.getBlueIdForSchema(baseSchema);

    if (isNullable(extendedBlueId) || isNullable(baseBlueId)) {
      return false;
    }

    if (extendedBlueId === baseBlueId) {
      return true;
    }

    if (isNonNullable(this.nodeProvider)) {
      try {
        const extendedNode = new BlueNode().setBlueId(extendedBlueId);
        const baseNode = new BlueNode().setBlueId(baseBlueId);
        if (isSubtype(extendedNode, baseNode, this.nodeProvider)) {
          return true;
        }
      } catch {
        // Swallow errors from subtype resolution and fall back to annotation-based lookup
      }
    }
    // No annotation-based fallback; rely solely on blueId equality or nodeProvider subtype resolution
    return false;
  }

  private getBlueIdForSchema(schema: ZodTypeAny | null | undefined) {
    if (isNullable(schema)) {
      return null;
    }

    const blueId = BlueIdResolver.resolveBlueId(schema);
    if (isNonNullable(blueId)) {
      return blueId;
    }

    for (const [registeredBlueId, registeredSchema] of this.blueIdMap) {
      if (
        registeredSchema === schema ||
        registeredSchema._def === schema._def
      ) {
        return registeredBlueId;
      }
    }

    return null;
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
