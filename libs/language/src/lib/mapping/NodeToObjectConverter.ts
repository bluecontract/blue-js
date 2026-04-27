import { ZodType } from 'zod';
import { ZodTypeDef } from 'zod';
import { BlueNode } from '../model';
import { TypeSchemaResolver } from '../utils/TypeSchemaResolver';
import { ConverterFactory } from './ConverterFactory';
import { isBlueNodeSchema } from '../../schema/annotations';
import { BlueNodeTypeSchema } from '../utils/TypeSchema';
import { isNonNullable } from '@blue-labs/shared-utils';
import { BlueIdCalculator } from '../utils';

export interface NodeToObjectConverterOptions {
  calculateBlueId?: (node: BlueNode) => string;
}

export class NodeToObjectConverter {
  private readonly converterFactory: ConverterFactory;
  private readonly calculateBlueId: (node: BlueNode) => string;

  constructor(
    private typeSchemaResolver?: TypeSchemaResolver | null,
    options: NodeToObjectConverterOptions = {},
  ) {
    this.calculateBlueId =
      options.calculateBlueId ??
      ((node) => BlueIdCalculator.calculateBlueIdSync(node));
    this.converterFactory = new ConverterFactory(this, this.calculateBlueId);
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
        { typeSchemaResolver: this.typeSchemaResolver },
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
