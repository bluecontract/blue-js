import {
  ZodTypeAny,
  ZodOptional,
  ZodNullable,
  ZodReadonly,
  ZodBranded,
  ZodEffects,
  ZodLazy,
  AnyZodObject,
} from 'zod';
import { BlueNode } from '../model';
import { BlueIdResolver } from './BlueIdResolver';
import { TypeSchemaResolver } from './TypeSchemaResolver';
import { isNullable, isNonNullable } from '@blue-labs/shared-utils';
import {
  isBlueNodeSchema,
  isSchemaExtendedFrom,
} from '../../schema/annotations';

export class BlueNodeTypeSchema {
  // TODO: Enhance to support schemas associated with multiple blueIds
  static isTypeOf(
    node: BlueNode,
    schema: AnyZodObject,
    options?: {
      checkSchemaExtensions?: boolean;
      typeSchemaResolver?: TypeSchemaResolver | null;
    }
  ): boolean {
    const schemaBlueId = BlueIdResolver.resolveBlueId(schema);
    const nodeTypeBlueId = node.getType()?.getBlueId();

    if (isNullable(schemaBlueId) || isNullable(nodeTypeBlueId)) {
      return false;
    }

    // Direct BlueId match
    if (schemaBlueId === nodeTypeBlueId) {
      return true;
    }

    // Check schema extensions if enabled and resolver is provided
    if (
      options?.checkSchemaExtensions &&
      isNonNullable(options.typeSchemaResolver)
    ) {
      const resolvedSchema = options.typeSchemaResolver.resolveSchema(node);
      return BlueNodeTypeSchema.checkSchemaExtension(resolvedSchema, schema);
    }

    return false;
  }

  /**
   * Checks if a schema extends a base schema.
   */
  static checkSchemaExtension(
    extendedSchema: ZodTypeAny | null | undefined,
    baseSchema: ZodTypeAny
  ): boolean {
    if (!isNonNullable(extendedSchema)) {
      return false;
    }

    const unwrappedExtendedSchema =
      BlueNodeTypeSchema.unwrapSchema(extendedSchema);
    const unwrappedBaseSchema = BlueNodeTypeSchema.unwrapSchema(baseSchema);

    return isSchemaExtendedFrom(unwrappedExtendedSchema, unwrappedBaseSchema);
  }

  private static isWrapperType(schema: ZodTypeAny) {
    return (
      schema instanceof ZodOptional ||
      schema instanceof ZodNullable ||
      schema instanceof ZodReadonly ||
      schema instanceof ZodBranded ||
      schema instanceof ZodEffects ||
      schema instanceof ZodLazy
    );
  }

  static unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
    if (isBlueNodeSchema(schema)) {
      return schema;
    }

    if (BlueNodeTypeSchema.isWrapperType(schema)) {
      if (schema instanceof ZodEffects) {
        return BlueNodeTypeSchema.unwrapSchema(schema.innerType());
      }
      if (schema instanceof ZodLazy) {
        return BlueNodeTypeSchema.unwrapSchema(schema.schema);
      }
      return BlueNodeTypeSchema.unwrapSchema(schema.unwrap());
    }

    return schema;
  }
}
