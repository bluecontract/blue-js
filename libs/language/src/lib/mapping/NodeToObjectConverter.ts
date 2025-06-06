import {
  ZodEffects,
  ZodLazy,
  ZodType,
  ZodBranded,
  ZodNullable,
  ZodOptional,
  ZodReadonly,
  ZodTypeAny,
} from 'zod';
import { ZodTypeDef } from 'zod';
import { BlueNode } from '../model';
import { TypeSchemaResolver } from '../utils/TypeSchemaResolver';
import { ConverterFactory } from './ConverterFactory';
import { isNonNullable } from '@blue-company/shared-utils';
import {
  isBlueNodeSchema,
  isSchemaExtendedFrom,
} from '@blue-company/schema-annotations';

export class NodeToObjectConverter {
  private readonly converterFactory: ConverterFactory;

  constructor(private typeSchemaResolver?: TypeSchemaResolver | null) {
    this.converterFactory = new ConverterFactory(this);
  }

  convert<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output
  >(node: BlueNode, targetType: ZodType<Output, Def, Input>): Output {
    const resolvedSchema = this.typeSchemaResolver?.resolveSchema(node);
    const unwrappedTargetType = this.unwrapSchema(targetType);

    if (isBlueNodeSchema(unwrappedTargetType)) {
      return node as Output;
    }

    let schemaToUse = unwrappedTargetType;

    if (
      isNonNullable(resolvedSchema) &&
      isSchemaExtendedFrom(resolvedSchema, unwrappedTargetType)
    ) {
      schemaToUse = resolvedSchema;
    }

    return this.convertWithType(node, schemaToUse);
  }

  private convertWithType<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output
  >(node: BlueNode, targetType: ZodType<Output, Def, Input>): Output {
    const converter = this.converterFactory.getConverter(targetType);
    return converter.convert(node, targetType) as Output;
  }

  private isWrapperType(schema: ZodType) {
    return (
      schema instanceof ZodOptional ||
      schema instanceof ZodNullable ||
      schema instanceof ZodReadonly ||
      schema instanceof ZodBranded ||
      schema instanceof ZodEffects ||
      schema instanceof ZodLazy
    );
  }

  private unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
    if (isBlueNodeSchema(schema)) {
      return schema;
    }

    if (this.isWrapperType(schema)) {
      if (schema instanceof ZodEffects) {
        return this.unwrapSchema(schema.innerType());
      }
      if (schema instanceof ZodLazy) {
        return this.unwrapSchema(schema.schema);
      }
      return this.unwrapSchema(schema.unwrap());
    }

    return schema;
  }
}
