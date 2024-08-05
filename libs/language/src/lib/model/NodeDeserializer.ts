import { BlueNode } from './Node';
import { JsonBlueValue } from '../../schema';
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
  CORE_TYPES,
  CORE_TYPE_NAME_TO_BLUE_ID_MAP,
  TEXT_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  NUMBER_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
} from '../utils/Properties';
import { isBigNumber } from '../../utils/typeGuards';
import { isReadonlyArray } from '@blue-company/shared-utils';
import Big from 'big.js';
import { isArray, isObject } from 'radash';

export class NodeDeserializer {
  static deserialize(json: JsonBlueValue) {
    return NodeDeserializer.handleNode(json);
  }

  private static handleNode(node: JsonBlueValue): BlueNode {
    if (node === undefined) {
      throw new Error(
        "This is not a valid JSON-like value. Found 'undefined' as a value."
      );
    } else if (
      isObject(node) &&
      !isArray(node) &&
      !isReadonlyArray(node) &&
      !isBigNumber(node)
    ) {
      const obj = new BlueNode();
      const properties = {} as Record<string, BlueNode>;

      Object.entries(node).forEach(([key, value]) => {
        switch (key) {
          case OBJECT_NAME:
            if (typeof value !== 'string') {
              throw new Error(`The ${OBJECT_NAME} field must be a string.`);
            }
            obj.setName(value);
            break;
          case OBJECT_DESCRIPTION:
            if (typeof value !== 'string') {
              throw new Error(
                `The ${OBJECT_DESCRIPTION} field must be a string.`
              );
            }
            obj.setDescription(value);
            break;
          case OBJECT_TYPE:
            obj.setType(NodeDeserializer.handleTypeNode(value));
            break;
          case OBJECT_ITEM_TYPE:
            obj.setItemType(NodeDeserializer.handleTypeNode(value));
            break;
          case OBJECT_KEY_TYPE:
            obj.setKeyType(NodeDeserializer.handleTypeNode(value));
            break;
          case OBJECT_VALUE_TYPE:
            obj.setValueType(NodeDeserializer.handleTypeNode(value));
            break;
          case OBJECT_VALUE:
            obj.setValue(
              NodeDeserializer.handleValueWithType(value, obj.getType())
            );
            break;
          case OBJECT_BLUE_ID:
            if (typeof value !== 'string') {
              throw new Error(`The ${OBJECT_BLUE_ID} field must be a string.`);
            }
            obj.setBlueId(value);
            break;
          case OBJECT_ITEMS:
            obj.setItems(NodeDeserializer.handleArray(value).getItems() ?? []);
            break;
          case OBJECT_BLUE:
            obj.setBlue(NodeDeserializer.handleNode(value));
            break;
          // TODO: Implement constraints
          // case OBJECT_CONSTRAINTS:
          //   obj.setConstraints(NodeDeserializer.handleConstraints(value));
          //   break;
          default:
            properties[key] = NodeDeserializer.handleNode(value);
            break;
        }
      });

      obj.setProperties(properties);
      obj.setInlineValue(false);
      return obj;
    } else if (Array.isArray(node) || isReadonlyArray(node)) {
      return NodeDeserializer.handleArray(node);
    } else {
      return new BlueNode()
        .setValue(NodeDeserializer.handleValue(node))
        .setInlineValue(true);
    }
  }

  private static handleTypeNode(typeNode: JsonBlueValue) {
    if (typeof typeNode === 'string') {
      if (CORE_TYPES.includes(typeNode as (typeof CORE_TYPES)[number])) {
        return new BlueNode().setBlueId(
          CORE_TYPE_NAME_TO_BLUE_ID_MAP[
            typeNode as keyof typeof CORE_TYPE_NAME_TO_BLUE_ID_MAP
          ]
        );
      } else {
        return new BlueNode().setValue(typeNode).setInlineValue(true);
      }
    } else {
      return NodeDeserializer.handleNode(typeNode);
    }
  }

  private static handleValueWithType(
    valueNode: JsonBlueValue,
    typeNode: BlueNode | undefined
  ) {
    if (!typeNode || !typeNode.getBlueId()) {
      return NodeDeserializer.handleValue(valueNode);
    }

    const typeBlueId = typeNode.getBlueId();
    if (typeBlueId === TEXT_TYPE_BLUE_ID) {
      return String(valueNode);
    } else if (
      typeBlueId === INTEGER_TYPE_BLUE_ID ||
      typeBlueId === NUMBER_TYPE_BLUE_ID
    ) {
      if (isBigNumber(valueNode)) {
        return valueNode;
      } else if (
        typeof valueNode === 'number' ||
        typeof valueNode === 'string'
      ) {
        return new Big(valueNode.toString());
      }
      throw new Error(
        `The ${OBJECT_VALUE} field must be a string or a number.`
      );
    } else if (typeBlueId === BOOLEAN_TYPE_BLUE_ID) {
      return typeof valueNode === 'string'
        ? valueNode.toLowerCase() === 'true'
        : Boolean(valueNode);
    } else {
      return NodeDeserializer.handleValue(valueNode);
    }
  }

  private static handleValue(node: JsonBlueValue) {
    if (
      typeof node === 'string' ||
      typeof node === 'number' ||
      typeof node === 'boolean'
    ) {
      return node;
    } else if (node === null) {
      return null;
    } else if (isBigNumber(node)) {
      return node;
    }
    throw new Error(`Can't handle node: ${JSON.stringify(node)}`);
  }

  private static handleArray(value: JsonBlueValue) {
    if (typeof value === 'string') {
      const singleItemList = [
        new BlueNode().setValue(value).setInlineValue(true),
      ];
      return new BlueNode().setItems(singleItemList).setInlineValue(false);
    } else if (Array.isArray(value)) {
      const result = value.map(NodeDeserializer.handleNode);
      return new BlueNode().setItems(result).setInlineValue(false);
    } else {
      throw new Error("The 'items' field must be an array or a string.");
    }
  }

  // TODO: Implement constraints
  // private static handleConstraints(constraintsNode: any): Constraints {
  //   return plainToClass(Constraints, constraintsNode);
  // }
}
