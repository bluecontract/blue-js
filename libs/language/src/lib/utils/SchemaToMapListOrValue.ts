import type { JsonObject, JsonValue } from 'type-fest';
import type { BlueNode } from '../model/Node';
import {
  isBooleanSchemaField,
  isIntegerSchemaField,
  isNumericSchemaField,
  type Schema,
  type SchemaField,
} from '../model/Schema';

type NodeConverter = (node: BlueNode) => JsonValue;
type ValueConverter = (value: BlueNode['value']) => JsonValue | undefined;

export class SchemaToMapListOrValue {
  static get(
    schema: Schema,
    nodeConverter: NodeConverter,
    valueConverter: ValueConverter,
  ): JsonObject {
    const result: JsonObject = {};

    for (const [field, node] of schema.entries()) {
      this.put(
        result,
        field,
        this.schemaFieldValue(field, node, nodeConverter, valueConverter),
      );
    }

    const enumValues = schema.getEnum();
    if (enumValues !== undefined) {
      result.enum = enumValues.map((node) =>
        this.scalarOrExplicitNode(node, nodeConverter, valueConverter),
      );
    }

    return result;
  }

  private static schemaFieldValue(
    field: SchemaField,
    node: BlueNode,
    nodeConverter: NodeConverter,
    valueConverter: ValueConverter,
  ): JsonValue {
    if (isBooleanSchemaField(field) || isIntegerSchemaField(field)) {
      return valueConverter(node.getValue()) ?? nodeConverter(node);
    }

    if (isNumericSchemaField(field)) {
      return this.numericValue(node, nodeConverter, valueConverter);
    }

    return nodeConverter(node);
  }

  private static numericValue(
    node: BlueNode,
    nodeConverter: NodeConverter,
    valueConverter: ValueConverter,
  ): JsonValue {
    return this.isPlainScalar(node)
      ? (valueConverter(node.getValue()) ?? nodeConverter(node))
      : nodeConverter(node);
  }

  private static scalarOrExplicitNode(
    node: BlueNode,
    nodeConverter: NodeConverter,
    valueConverter: ValueConverter,
  ): JsonValue {
    return this.isPlainScalar(node)
      ? (valueConverter(node.getValue()) ?? nodeConverter(node))
      : nodeConverter(node);
  }

  private static isPlainScalar(node: BlueNode): boolean {
    return (
      node.getValue() !== undefined &&
      node.getValue() !== null &&
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getValueType() === undefined &&
      node.getItems() === undefined &&
      node.getProperties() === undefined &&
      node.getContractsNode() === undefined &&
      node.getBlueId() === undefined &&
      node.getSchema() === undefined &&
      node.getMergePolicy() === undefined &&
      node.getPreviousBlueId() === undefined &&
      node.getPosition() === undefined &&
      node.getBlue() === undefined
    );
  }

  private static put(
    result: JsonObject,
    key: string,
    value: JsonValue | undefined,
  ): void {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
}
