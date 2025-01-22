import { ZodMap, ZodRecord } from 'zod';
import { BlueNode } from '../model';
import { Converter } from './Converter';
import { NodeToObjectConverter } from './NodeToObjectConverter';
import { isNonNullable } from '@blue-company/shared-utils';
import { ValueConverter } from './ValueConverter';
import { TEXT_TYPE_BLUE_ID } from '../utils/Properties';

export class MapConverter implements Converter {
  constructor(private readonly nodeToObjectConverter: NodeToObjectConverter) {}

  convert(node: BlueNode, targetType: ZodRecord | ZodMap) {
    const keySchema = targetType.keySchema;
    const valueSchema = targetType.valueSchema;

    const result = new Map<unknown, unknown>();

    const nodeName = node.getName();
    if (isNonNullable(nodeName)) {
      result.set('name', nodeName);
    }

    const nodeDescription = node.getDescription();
    if (isNonNullable(nodeDescription)) {
      result.set('description', nodeDescription);
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
