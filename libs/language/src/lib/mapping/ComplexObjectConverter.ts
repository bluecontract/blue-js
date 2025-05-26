import {
  ZodIntersection,
  ZodMap,
  ZodObject,
  ZodRecord,
  ZodObjectDef,
  ZodType,
  ZodUnion,
  ZodUnknown,
  ZodAny,
} from 'zod';
import { BlueNode, NodeDeserializer } from '../model';
import { BlueIdCalculator, NodeToMapListOrValue } from '../utils';
import { isNonNullable, isNullable } from '@blue-company/shared-utils';
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
  constructor(private readonly nodeToObjectConverter: NodeToObjectConverter) {}

  /**
   * Check if the valueSchema can handle structured data (contracts should be processed specially)
   */
  private canHandleStructuredData(valueSchema: ZodTypeAny): boolean {
    return (
      valueSchema instanceof ZodAny ||
      valueSchema instanceof ZodObject ||
      valueSchema instanceof ZodRecord ||
      valueSchema instanceof ZodMap ||
      valueSchema instanceof ZodUnknown
    );
  }

  public convert<
    T extends ZodRawShape,
    UnknownKeys extends UnknownKeysParam = UnknownKeysParam,
    Catchall extends ZodTypeAny = ZodTypeAny,
    Output = objectOutputType<T, Catchall, UnknownKeys>,
    Input = objectInputType<T, Catchall, UnknownKeys>
  >(
    node: BlueNode,
    targetType: ZodType<Output, ZodObjectDef<T, UnknownKeys, Catchall>, Input>
  ) {
    return this.convertFields(node, targetType) as Output;
  }

  private convertFields(node: BlueNode, schema: ZodTypeAny): unknown {
    if (schema instanceof ZodIntersection) {
      const left = schema._def.left;
      const right = schema._def.right;

      const leftResult = this.convert(node, left);
      const rightResult = this.convert(node, right);

      return { ...leftResult, ...rightResult };
    }

    if (schema instanceof ZodUnion) {
      throw new Error('Union not supported');
    }

    if (schema instanceof ZodObject) {
      const result = Object.keys(schema.shape).reduce((acc, propertyName) => {
        const properties = node.getProperties();
        const schemaProperty = schema.shape[propertyName];

        const blueIdAnnotation = getBlueIdAnnotation(schemaProperty);
        if (isNonNullable(blueIdAnnotation)) {
          const propertyNameWithAnnotation = isString(blueIdAnnotation)
            ? blueIdAnnotation
            : propertyName;

          const propertyNode = properties?.[propertyNameWithAnnotation];
          const blueId = propertyNode
            ? BlueIdCalculator.calculateBlueIdSync(propertyNode)
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

        const contracts = node.getContracts();
        if (
          propertyName === 'contracts' &&
          isNonNullable(contracts) &&
          this.canHandleStructuredData(schemaProperty)
        ) {
          const contractsJson = Object.fromEntries(
            Object.entries(contracts).map(([key, value]) => [
              key,
              NodeToMapListOrValue.get(value),
            ])
          );
          const contractsNode = NodeDeserializer.deserialize(contractsJson);
          acc[propertyName] = this.nodeToObjectConverter.convert(
            contractsNode,
            schemaProperty
          );
        }

        const propertyNode = properties?.[propertyName];

        if (isNullable(propertyNode)) {
          return acc;
        }

        const converted = this.nodeToObjectConverter.convert(
          propertyNode,
          schemaProperty
        );
        acc[propertyName] = converted;

        return acc;
      }, {} as Record<string, unknown>);

      return result;
    }

    throw new Error('Unknown schema type, ' + schema.constructor.name);
  }
}
