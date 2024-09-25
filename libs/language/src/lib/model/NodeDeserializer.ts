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
} from '../utils/Properties';
import { isBigIntegerNumber, isBigNumber } from '../../utils/typeGuards';
import { isReadonlyArray } from '@blue-company/shared-utils';
import { isArray, isObject } from 'radash';
import { BigIntegerNumber } from './BigIntegerNumber';
import { BigDecimalNumber } from './BigDecimalNumber';

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
                `The ${OBJECT_DESCRIPTION} field must be a string.`
              );
            } else {
              obj.setDescription(value);
            }
            break;
          case OBJECT_TYPE:
            obj.setType(NodeDeserializer.handleNode(value));
            break;
          case OBJECT_ITEM_TYPE:
            obj.setItemType(NodeDeserializer.handleNode(value));
            break;
          case OBJECT_KEY_TYPE:
            obj.setKeyType(NodeDeserializer.handleNode(value));
            break;
          case OBJECT_VALUE_TYPE:
            obj.setValueType(NodeDeserializer.handleNode(value));
            break;
          case OBJECT_VALUE:
            obj.setValue(NodeDeserializer.handleValue(value));
            break;
          case OBJECT_BLUE_ID:
            if (typeof value !== 'string') {
              throw new Error(`The ${OBJECT_BLUE_ID} field must be a string.`);
            }
            obj.setBlueId(value);
            break;
          case OBJECT_ITEMS:
            obj.setItems(NodeDeserializer.handleArray(value));
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

      if (Object.keys(properties).length > 0) {
        obj.setProperties(properties);
      }
      return obj;
    } else if (Array.isArray(node) || isReadonlyArray(node)) {
      return new BlueNode().setItems(NodeDeserializer.handleArray(node));
    } else {
      return new BlueNode()
        .setValue(NodeDeserializer.handleValue(node))
        .setInlineValue(true);
    }
  }

  private static handleValue(node: JsonBlueValue) {
    if (node === null || node === undefined) {
      return null;
    } else if (typeof node === 'string') {
      return node;
    } else if (typeof node === 'number' || isBigNumber(node)) {
      if (isBigIntegerNumber(node) || Number.isSafeInteger(node)) {
        const bigInt = new BigIntegerNumber(node.toString());
        const lowerBound = Number.MIN_SAFE_INTEGER; // -9007199254740991
        const upperBound = Number.MAX_SAFE_INTEGER; // 9007199254740991
        if (bigInt.lt(lowerBound)) {
          return new BigIntegerNumber(lowerBound.toString());
        } else if (bigInt.gt(upperBound)) {
          return new BigIntegerNumber(upperBound.toString());
        } else {
          return bigInt;
        }
      } else {
        const doubleValue = parseFloat(node.toString());
        return new BigDecimalNumber(doubleValue.toString());
      }
    } else if (typeof node === 'boolean') {
      return node;
    }
    throw new Error(`Can't handle node: ${JSON.stringify(node)}`);
  }

  private static handleArray(value: JsonBlueValue) {
    if (value === null || value === undefined) {
      return undefined;
    } else if (isObject(value) && !Array.isArray(value)) {
      const singleItemList = [NodeDeserializer.handleNode(value)];
      return singleItemList;
    } else if (Array.isArray(value)) {
      return value.map(NodeDeserializer.handleNode);
    } else {
      throw new Error('Expected an array node');
    }
  }

  // TODO: Implement constraints
  // private static handleConstraints(constraintsNode: any): Constraints {
  //   return plainToClass(Constraints, constraintsNode);
  // }
}
