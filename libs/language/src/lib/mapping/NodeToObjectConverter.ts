import { ZodType } from 'zod';
import { ZodTypeDef } from 'zod';
import { BlueNode } from '../model';
import { TypeSchemaResolver } from '../utils/TypeSchemaResolver';
import { ConverterFactory } from './ConverterFactory';
import { isBlueNodeSchema } from '../../schema/annotations';
import { BlueNodeTypeSchema } from '../utils/TypeSchema';
import { isNonNullable } from '@blue-labs/shared-utils';

export class NodeToObjectConverter {
  private readonly converterFactory: ConverterFactory;

  constructor(private typeSchemaResolver?: TypeSchemaResolver | null) {
    this.converterFactory = new ConverterFactory(this);
  }

  convert<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output,
  >(node: BlueNode, targetType: ZodType<Output, Def, Input>): Output {
    const resolvedSchema = this.typeSchemaResolver?.resolveSchema(node);
    const unwrappedTargetType = BlueNodeTypeSchema.unwrapSchema(targetType);

    if (isBlueNodeSchema(unwrappedTargetType)) {
      return node as Output;
    }

    let schemaToUse = unwrappedTargetType;

    if (
      BlueNodeTypeSchema.checkSchemaExtension(
        resolvedSchema,
        unwrappedTargetType,
      ) &&
      isNonNullable(resolvedSchema)
    ) {
      schemaToUse = resolvedSchema;
    }

    return this.convertWithType(node, schemaToUse);
  }

  private convertWithType<
    Output = unknown,
    Def extends ZodTypeDef = ZodTypeDef,
    Input = Output,
  >(node: BlueNode, targetType: ZodType<Output, Def, Input>): Output {
    const converter = this.converterFactory.getConverter(targetType);
    return converter.convert(node, targetType) as Output;
  }
}
