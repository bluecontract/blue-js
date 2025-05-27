import {
  ZodMap,
  ZodRecord,
  ZodAny,
  ZodObject,
  ZodTypeAny,
  ZodUnknown,
} from 'zod';
import { BlueNode } from '../model';
import { Converter } from './Converter';
import { NodeToObjectConverter } from './NodeToObjectConverter';
import { isNonNullable } from '@blue-company/shared-utils';
import { ValueConverter } from './ValueConverter';
import {
  OBJECT_CONTRACTS,
  OBJECT_DESCRIPTION,
  OBJECT_NAME,
  TEXT_TYPE_BLUE_ID,
} from '../utils/Properties';

export class MapConverter implements Converter {
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

  convert(node: BlueNode, targetType: ZodRecord | ZodMap) {
    const keySchema = targetType.keySchema;
    const valueSchema = targetType.valueSchema;

    const result = new Map<unknown, unknown>();

    const nodeName = node.getName();
    if (isNonNullable(nodeName)) {
      result.set(OBJECT_NAME, nodeName);
    }

    const nodeDescription = node.getDescription();
    if (isNonNullable(nodeDescription)) {
      result.set(OBJECT_DESCRIPTION, nodeDescription);
    }

    const contracts = node.getContracts();
    if (isNonNullable(contracts) && this.canHandleStructuredData(valueSchema)) {
      let hasValidContracts = false;
      const convertedContracts = Object.entries(contracts).reduce(
        (acc, [contractKey, contract]) => {
          try {
            const convertedValue = this.nodeToObjectConverter.convert(
              contract,
              valueSchema
            );

            const isValidConversion =
              convertedValue !== null &&
              convertedValue !== undefined &&
              !Number.isNaN(convertedValue);

            if (isValidConversion) {
              acc[contractKey] = convertedValue;
              hasValidContracts = true;
            }
          } catch {
            // Skip contracts that can't convert to the valueSchema
          }

          return acc;
        },
        {} as Record<string, unknown>
      );

      if (hasValidContracts) {
        result.set(OBJECT_CONTRACTS, convertedContracts);
      }
    }

    const properties = node.getProperties();
    if (isNonNullable(properties)) {
      Object.entries(properties).forEach(([key, property]) => {
        const keyNode = new BlueNode().setValue(key);
        keyNode.setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));

        const keyConverted = ValueConverter.convertValue(keyNode, keySchema);
        const value = this.nodeToObjectConverter.convert(property, valueSchema);
        result.set(keyConverted, value);
      });
    }

    if (targetType instanceof ZodRecord) {
      return Object.fromEntries(result) as Record<
        string | number | symbol,
        unknown
      >;
    }

    return result;
  }
}
