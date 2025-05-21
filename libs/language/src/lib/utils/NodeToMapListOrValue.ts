import { JsonObject, JsonValue } from 'type-fest';
import { BlueNode } from '../model/Node';
import Big from 'big.js';
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
  TEXT_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
} from './Properties';
import { isBigIntegerNumber, isBigNumber } from '../../utils/typeGuards';

export type Strategy = 'official' | 'simple';

export class NodeToMapListOrValue {
  static get(node: BlueNode, strategy: Strategy = 'official'): JsonValue {
    const value = node.getValue();
    const handledValue = this.handleValue(value);
    if (handledValue !== undefined && strategy === 'simple') {
      return handledValue;
    }

    const items = node
      .getItems()
      ?.map((item) => NodeToMapListOrValue.get(item, strategy));
    if (items !== undefined && strategy === 'simple') {
      return items;
    }

    const result: JsonObject = {};
    const name = node.getName();
    if (name !== undefined) {
      result[OBJECT_NAME] = name;
    }

    const description = node.getDescription();
    if (description !== undefined) {
      result[OBJECT_DESCRIPTION] = description;
    }

    const type = node.getType();
    if (strategy === 'official' && value !== undefined && type === undefined) {
      const inferredTypeBlueId = this.inferTypeBlueId(value);
      if (inferredTypeBlueId !== null) {
        result[OBJECT_TYPE] = { [OBJECT_BLUE_ID]: inferredTypeBlueId };
      }
    } else if (type !== undefined) {
      result[OBJECT_TYPE] = NodeToMapListOrValue.get(type, strategy);
    }

    const itemType = node.getItemType();
    if (itemType !== undefined) {
      result[OBJECT_ITEM_TYPE] = NodeToMapListOrValue.get(itemType, strategy);
    }

    const keyType = node.getKeyType();
    if (keyType !== undefined) {
      result[OBJECT_KEY_TYPE] = NodeToMapListOrValue.get(keyType, strategy);
    }

    const valueType = node.getValueType();
    if (valueType !== undefined) {
      result[OBJECT_VALUE_TYPE] = NodeToMapListOrValue.get(valueType, strategy);
    }

    if (handledValue !== undefined) {
      result[OBJECT_VALUE] = handledValue;
    }

    if (items !== undefined) {
      result[OBJECT_ITEMS] = items;
    }

    const blueId = node.getBlueId();
    if (blueId !== undefined) {
      result[OBJECT_BLUE_ID] = blueId;
    }

    const blue = node.getBlue();
    if (blue !== undefined) {
      result[OBJECT_BLUE] = blue as unknown as JsonValue;
    }

    const contracts = node.getContracts();
    if (contracts !== undefined) {
      const contractsMap: JsonObject = {};
      Object.entries(contracts).forEach(([key, value]) => {
        contractsMap[key] = NodeToMapListOrValue.get(value, strategy);
      });
      result[OBJECT_CONTRACTS] = contractsMap;
    }

    const properties = node.getProperties();
    if (properties !== undefined) {
      Object.entries(properties).forEach(([key, value]) => {
        result[key] = NodeToMapListOrValue.get(value, strategy);
      });
    }

    return result;
  }

  static handleValue(value: BlueNode['value']) {
    if (isBigNumber(value)) {
      if (isBigIntegerNumber(value)) {
        const lowerBound = new Big(Number.MIN_SAFE_INTEGER.toString());
        const upperBound = new Big(Number.MAX_SAFE_INTEGER.toString());

        if (value.lt(lowerBound) || value.gt(upperBound)) {
          return value.toString();
        }
      }
      return value.toNumber();
    }
    return value;
  }

  private static inferTypeBlueId(value: BlueNode['value']) {
    if (typeof value === 'string') {
      return TEXT_TYPE_BLUE_ID;
    } else if (isBigNumber(value)) {
      return isBigIntegerNumber(value)
        ? INTEGER_TYPE_BLUE_ID
        : DOUBLE_TYPE_BLUE_ID;
    } else if (typeof value === 'boolean') {
      return BOOLEAN_TYPE_BLUE_ID;
    }
    return null;
  }
}
