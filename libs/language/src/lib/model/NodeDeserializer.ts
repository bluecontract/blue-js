import { BlueNode } from './Node';
import { isJsonBlueArray, isJsonBlueObject, JsonBlueValue } from '../../schema';
import {
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_ITEMS,
  OBJECT_NAME,
  OBJECT_TYPE,
  OBJECT_VALUE,
  OBJECT_ITEM_TYPE,
  OBJECT_KEY_TYPE,
  OBJECT_VALUE_TYPE,
  OBJECT_BLUE,
  OBJECT_CONTRACTS,
  OBJECT_SCHEMA,
  OBJECT_MERGE_POLICY,
  OBJECT_CONSTRAINTS,
  OBJECT_PROPERTIES,
  LIST_CONTROL_PREVIOUS,
  LIST_CONTROL_POS,
  BOOLEAN_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  TEXT_TYPE_BLUE_ID,
} from '../utils/Properties';
import { isBigIntegerNumber, isBigNumber } from '../../utils/typeGuards';
import { isObject } from 'radash';
import { BigIntegerNumber } from './BigIntegerNumber';
import { BigDecimalNumber } from './BigDecimalNumber';
import {
  isBooleanSchemaField,
  isIntegerSchemaField,
  Schema,
  SCHEMA_FIELDS,
  SchemaField,
} from './Schema';

const MIN_SAFE_INTEGER = new BigIntegerNumber(
  Number.MIN_SAFE_INTEGER.toString(),
);
const MAX_SAFE_INTEGER = new BigIntegerNumber(
  Number.MAX_SAFE_INTEGER.toString(),
);
interface DeserializeOptions {
  readonly root: boolean;
  readonly strictReferenceOnly: boolean;
}

export class NodeDeserializer {
  static deserialize(json: unknown) {
    return NodeDeserializer.handleNode(json, {
      root: true,
      strictReferenceOnly: true,
    });
  }

  static deserializeUnchecked(json: unknown) {
    return NodeDeserializer.handleNode(json, {
      root: false,
      strictReferenceOnly: false,
    });
  }

  private static handleNode(
    node: unknown,
    options: DeserializeOptions = {
      root: false,
      strictReferenceOnly: true,
    },
  ): BlueNode {
    if (node === undefined) {
      throw new Error(
        "This is not a valid JSON-like value. Found 'undefined' as a value.",
      );
    } else if (node === null && options.root) {
      throw new Error('Root null is not a valid Blue document.');
    } else if (isJsonBlueObject(node)) {
      const obj = new BlueNode();
      const properties = {} as Record<string, BlueNode>;

      Object.entries(node).forEach(([key, value]) => {
        switch (key) {
          case OBJECT_NAME:
            if (value === null || value === undefined) {
              obj.setName(undefined);
            } else if (typeof value !== 'string') {
              throw new Error(`The ${OBJECT_NAME} field must be a string.`);
            } else {
              obj.setName(value);
            }
            break;
          case OBJECT_DESCRIPTION:
            if (value === null || value === undefined) {
              obj.setDescription(undefined);
            } else if (typeof value !== 'string') {
              throw new Error(
                `The ${OBJECT_DESCRIPTION} field must be a string.`,
              );
            } else {
              obj.setDescription(value);
            }
            break;
          case OBJECT_TYPE:
            obj.setType(
              NodeDeserializer.handleNode(value, {
                ...options,
                root: false,
              }),
            );
            break;
          case OBJECT_ITEM_TYPE:
            obj.setItemType(
              NodeDeserializer.handleNode(value, {
                ...options,
                root: false,
              }),
            );
            break;
          case OBJECT_KEY_TYPE:
            obj.setKeyType(
              NodeDeserializer.handleNode(value, {
                ...options,
                root: false,
              }),
            );
            break;
          case OBJECT_VALUE_TYPE:
            obj.setValueType(
              NodeDeserializer.handleNode(value, {
                ...options,
                root: false,
              }),
            );
            break;
          case OBJECT_MERGE_POLICY:
            if (
              value !== 'positional' &&
              value !== 'append-only' &&
              value !== undefined
            ) {
              throw new Error(
                'The mergePolicy field must be "positional" or "append-only".',
              );
            }
            obj.setMergePolicy(value);
            break;
          case OBJECT_VALUE:
            obj.setValue(NodeDeserializer.handleValue(value));
            break;
          case OBJECT_BLUE_ID:
            if (options.strictReferenceOnly && Object.keys(node).length !== 1) {
              throw new Error(
                'blueId nodes must be reference-only and cannot contain sibling fields.',
              );
            }
            if (typeof value !== 'string') {
              throw new Error(`The ${OBJECT_BLUE_ID} field must be a string.`);
            }
            obj.setBlueId(value);
            break;
          case OBJECT_ITEMS:
            obj.setItems(NodeDeserializer.handleArray(value, options));
            break;
          case OBJECT_BLUE:
            obj.setBlue(
              NodeDeserializer.handleNode(value, {
                ...options,
                root: false,
              }),
            );
            break;
          case LIST_CONTROL_PREVIOUS:
            if (Object.keys(node).length !== 1) {
              throw new Error(
                '$previous list anchors must be single-key list items.',
              );
            }
            obj.setPreviousBlueId(NodeDeserializer.handlePreviousBlueId(value));
            break;
          case LIST_CONTROL_POS:
            obj.setPosition(NodeDeserializer.handlePosition(value));
            break;
          case OBJECT_SCHEMA:
            obj.setSchema(NodeDeserializer.handleSchema(value, options));
            break;
          case OBJECT_CONTRACTS:
            properties[key] = NodeDeserializer.handleNode(value, {
              ...options,
              root: false,
            });
            break;
          case OBJECT_CONSTRAINTS:
            throw new Error(
              'constraints is not part of the Blue Language 1.0 top-level vocabulary.',
            );
          case OBJECT_PROPERTIES:
            throw new Error(
              'properties is an internal field and must not appear in Blue documents.',
            );
          default:
            properties[key] = NodeDeserializer.handleNode(value, {
              ...options,
              root: false,
            });
            break;
        }
      });

      if (Object.keys(properties).length > 0) {
        obj.setProperties(properties);
      }
      return obj;
    } else if (isJsonBlueArray(node)) {
      return new BlueNode().setItems(
        NodeDeserializer.handleArray(node, options),
      );
    } else {
      const nodeValue = node as JsonBlueValue;
      return new BlueNode()
        .setValue(NodeDeserializer.handleValue(nodeValue))
        .setInlineValue(true);
    }
  }

  private static handleValue(node: JsonBlueValue) {
    if (node === null || node === undefined) {
      return null;
    } else if (typeof node === 'string') {
      return node;
    } else if (typeof node === 'number' || isBigNumber(node)) {
      if (
        typeof node === 'number' &&
        Number.isInteger(node) &&
        !Number.isSafeInteger(node)
      ) {
        throw new Error(
          'Unquoted integers outside [-9007199254740991, 9007199254740991] must be quoted and explicitly typed as Integer.',
        );
      }
      if (isBigIntegerNumber(node) || Number.isSafeInteger(node)) {
        const bigInt = new BigIntegerNumber(node.toString());
        if (bigInt.lt(MIN_SAFE_INTEGER) || bigInt.gt(MAX_SAFE_INTEGER)) {
          throw new Error(
            'Unquoted integers outside [-9007199254740991, 9007199254740991] must be quoted and explicitly typed as Integer.',
          );
        }
        return bigInt;
      } else {
        const doubleValue = parseFloat(node.toString());
        return new BigDecimalNumber(doubleValue.toString());
      }
    } else if (typeof node === 'boolean') {
      return node;
    }
    throw new Error(`Can't handle node: ${JSON.stringify(node)}`);
  }

  private static handleArray(
    value: JsonBlueValue,
    options: DeserializeOptions,
  ) {
    if (value === null || value === undefined) {
      return undefined;
    } else if (isObject(value) && !Array.isArray(value)) {
      const singleItemList = [
        NodeDeserializer.handleNode(value, {
          ...options,
          root: false,
        }),
      ];
      return singleItemList;
    } else if (Array.isArray(value)) {
      return value.map((item) =>
        NodeDeserializer.handleNode(item, {
          ...options,
          root: false,
        }),
      );
    } else {
      throw new Error('Expected an array node');
    }
  }

  private static handlePreviousBlueId(value: unknown): string {
    if (!isJsonBlueObject(value) || Object.keys(value).length !== 1) {
      throw new Error(
        '$previous must have shape { blueId: <PrevListBlueId> }.',
      );
    }
    const blueId = value[OBJECT_BLUE_ID];
    if (typeof blueId !== 'string') {
      throw new Error('$previous.blueId must be a string.');
    }
    return blueId;
  }

  private static handlePosition(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new Error('$pos must be a non-negative integer.');
    }
    return value;
  }

  private static handleSchema(
    value: unknown,
    options: DeserializeOptions,
  ): Schema {
    if (!isJsonBlueObject(value)) {
      throw new Error('schema must be an object.');
    }
    const schema = new Schema();
    for (const key of Object.keys(value)) {
      if (key === 'enum') {
        const enumValue = value[key];
        if (!Array.isArray(enumValue)) {
          throw new Error('schema.enum must be a list.');
        }
        schema.setEnum(
          enumValue.map((item) =>
            NodeDeserializer.handleNode(item, {
              ...options,
              root: false,
            }),
          ),
        );
        continue;
      }
      if (!SCHEMA_FIELDS.includes(key as SchemaField)) {
        throw new Error(`schema.${key} is not part of the Blue language core.`);
      }
      NodeDeserializer.validateSchemaKeywordShape(
        key as SchemaField,
        value[key],
        options,
      );
      schema.set(
        key as SchemaField,
        NodeDeserializer.handleNode(value[key], {
          ...options,
          root: false,
        }),
      );
    }
    return schema;
  }

  private static validateSchemaKeywordShape(
    key: SchemaField,
    value: JsonBlueValue,
    options: DeserializeOptions,
  ): void {
    if (isBooleanSchemaField(key)) {
      if (typeof value !== 'boolean') {
        throw new Error(`schema.${key} must be a boolean.`);
      }
      return;
    }
    if (isIntegerSchemaField(key)) {
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < 0 ||
        !Number.isSafeInteger(value)
      ) {
        throw new Error(
          `schema.${key} must be a non-negative integer in the interoperable range.`,
        );
      }
      return;
    }
    if (isJsonBlueObject(value)) {
      const node = NodeDeserializer.handleNode(value, {
        ...options,
        root: false,
      });
      if (NodeDeserializer.isExplicitNumericValue(node)) {
        return;
      }
      throw new Error(
        `schema.${key} must be numeric or an explicit numeric scalar node.`,
      );
    }
    if (typeof value !== 'number' && !isBigNumber(value)) {
      throw new Error(
        `schema.${key} must be numeric or an explicit numeric scalar node.`,
      );
    }
  }

  private static isExplicitNumericValue(node: BlueNode): boolean {
    if (!NodeDeserializer.isExplicitSchemaScalar(node, true)) {
      return false;
    }

    const value = node.getValue();
    const type = node.getType();
    if (isBigNumber(value) || typeof value === 'number') {
      return type === undefined || NodeDeserializer.isNumericType(type);
    }

    return false;
  }

  private static isExplicitSchemaScalar(
    node: BlueNode,
    allowType: boolean,
  ): boolean {
    const type = node.getType();
    return (
      node.getValue() !== undefined &&
      node.getValue() !== null &&
      (allowType || type === undefined) &&
      node.getName() === undefined &&
      node.getDescription() === undefined &&
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
      node.getBlue() === undefined &&
      (type === undefined || NodeDeserializer.isScalarType(type))
    );
  }

  private static isScalarType(type: BlueNode): boolean {
    return (
      NodeDeserializer.isCoreType(type, TEXT_TYPE_BLUE_ID, 'Text') ||
      NodeDeserializer.isCoreType(type, INTEGER_TYPE_BLUE_ID, 'Integer') ||
      NodeDeserializer.isCoreType(type, DOUBLE_TYPE_BLUE_ID, 'Double') ||
      NodeDeserializer.isCoreType(type, BOOLEAN_TYPE_BLUE_ID, 'Boolean')
    );
  }

  private static isNumericType(type: BlueNode): boolean {
    return (
      NodeDeserializer.isCoreType(type, INTEGER_TYPE_BLUE_ID, 'Integer') ||
      NodeDeserializer.isCoreType(type, DOUBLE_TYPE_BLUE_ID, 'Double')
    );
  }

  private static isCoreType(
    type: BlueNode,
    blueId: string,
    alias: string,
  ): boolean {
    return (
      type.getBlueId() === blueId ||
      (type.isInlineValue() && type.getValue() === alias)
    );
  }
}
