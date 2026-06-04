import { ZodIntersection, ZodObject, ZodObjectDef, ZodType } from 'zod';
import { BlueNode } from '../model';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';
import {
  getBlueDescriptionAnnotation,
  getBlueIdAnnotation,
  getBlueNameAnnotation,
} from '../../schema/annotations';
import { isString } from 'radash';
import { Converter } from './Converter';
import {
  ZodRawShape,
  ZodTypeAny,
  objectOutputType,
  objectInputType,
  UnknownKeysParam,
} from 'zod';
import { NodeToObjectConverter } from './NodeToObjectConverter';

export class ComplexObjectConverter implements Converter {
  constructor(
    private readonly nodeToObjectConverter: NodeToObjectConverter,
    private readonly calculateBlueId: (node: BlueNode) => string,
  ) {}

  public convert<
    T extends ZodRawShape,
    UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
    Catchall extends ZodTypeAny = ZodTypeAny,
    Output = objectOutputType<T, Catchall, UnknownKeys>,
    Input = objectInputType<T, Catchall, UnknownKeys>,
  >(
    node: BlueNode,
    targetType: ZodType<Output, ZodObjectDef<T, UnknownKeys, Catchall>, Input>,
  ) {
    return this.convertFields(node, targetType) as Output;
  }

  private convertFields(node: BlueNode, schema: ZodTypeAny): unknown {
    if (zodTypeName(schema) === 'ZodIntersection') {
      const intersection = schema as ZodIntersection<ZodTypeAny, ZodTypeAny>;
      const left = intersection._def.left;
      const right = intersection._def.right;

      const leftResult = this.convert(node, left);
      const rightResult = this.convert(node, right);

      return { ...leftResult, ...rightResult };
    }

    if (zodTypeName(schema) === 'ZodUnion') {
      throw new Error('Union not supported');
    }

    if (zodTypeName(schema) === 'ZodObject') {
      const objectSchema = schema as ZodObject<ZodRawShape>;
      const result = Object.keys(objectSchema.shape).reduce(
        (acc, propertyName) => {
          const properties = node.getProperties();
          const schemaProperty = objectSchema.shape[propertyName];

          const blueIdAnnotation = getBlueIdAnnotation(schemaProperty);
          if (isNonNullable(blueIdAnnotation)) {
            const propertyNameWithAnnotation = isString(blueIdAnnotation)
              ? blueIdAnnotation
              : propertyName;

            const propertyNode = properties?.[propertyNameWithAnnotation];
            const blueId = propertyNode
              ? this.calculateBlueId(propertyNode)
              : undefined;

            acc[propertyName] = blueId;

            return acc;
          }

          const blueNameAnnotation = getBlueNameAnnotation(schemaProperty);
          if (isNonNullable(blueNameAnnotation)) {
            const propertyNode = properties?.[blueNameAnnotation];
            acc[propertyName] = propertyNode?.getName();
            return acc;
          }

          const blueDescriptionAnnotation =
            getBlueDescriptionAnnotation(schemaProperty);
          if (isNonNullable(blueDescriptionAnnotation)) {
            const propertyNode = properties?.[blueDescriptionAnnotation];
            acc[propertyName] = propertyNode?.getDescription();
            return acc;
          }

          if (propertyName === 'name') {
            const name = node.getName();
            acc[propertyName] = name;

            return acc;
          }

          if (propertyName === 'description') {
            const description = node.getDescription();
            acc[propertyName] = description;

            return acc;
          }

          const propertyNode = properties?.[propertyName];

          if (isNullable(propertyNode)) {
            return acc;
          }

          const converted = this.nodeToObjectConverter.convert(
            propertyNode,
            schemaProperty,
          );
          acc[propertyName] = converted;

          return acc;
        },
        {} as Record<string, unknown>,
      );

      return result;
    }

    throw new Error('Unknown schema type, ' + schema._def.typeName);
  }
}

function zodTypeName(schema: ZodTypeAny): string {
  return String(schema._def.typeName);
}
