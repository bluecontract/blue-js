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
  OBJECT_SCHEMA,
  OBJECT_MERGE_POLICY,
  OBJECT_CONTRACTS,
  LIST_CONTROL_PREVIOUS,
  LIST_CONTROL_POS,
  TEXT_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
} from './Properties';
import { isBigIntegerNumber, isBigNumber } from '../../utils/typeGuards';

/**
 * Strategy for converting BlueNode to JSON representation.
 *
 * @public
 */
export type Strategy = 'official' | 'simple' | 'original';

export interface NodeToMapListOrValueOptions {
  strategy?: Strategy;
}

export class NodeToMapListOrValue {
  /**
   * Converts a BlueNode to a JSON representation based on the specified strategy.
   *
   * @param node - The BlueNode to convert.
   * @param strategy - The conversion strategy to use. Defaults to 'official'.
   *   - `'official'`: Always returns complete objects with type information and metadata
   *   - `'simple'`: Returns unwrapped values/arrays when possible, objects when metadata exists
   *   - `'original'`: Returns simple values when no name/description, otherwise full objects
   * @returns A JSON representation of the node.
   */
  static get(
    node: BlueNode,
    strategyOrOptions: Strategy | NodeToMapListOrValueOptions = 'official',
  ): JsonValue {
    const { strategy } = this.normalizeOptions(strategyOrOptions);
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

    const name = node.getName();
    const description = node.getDescription();

    if (
      strategy === 'original' &&
      name === undefined &&
      description === undefined
    ) {
      if (handledValue !== undefined) {
        return handledValue;
      }
      if (items !== undefined) {
        return items;
      }
    }

    const result: JsonObject = {};
    if (name !== undefined) {
      result[OBJECT_NAME] = name;
    }

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

    const mergePolicy = node.getMergePolicy();
    if (mergePolicy !== undefined) {
      result[OBJECT_MERGE_POLICY] = mergePolicy;
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
      result[OBJECT_BLUE] = NodeToMapListOrValue.get(blue, strategy);
    }

    const previousBlueId = node.getPreviousBlueId();
    if (previousBlueId !== undefined) {
      result[LIST_CONTROL_PREVIOUS] = { [OBJECT_BLUE_ID]: previousBlueId };
    }

    const position = node.getPosition();
    if (position !== undefined) {
      result[LIST_CONTROL_POS] = position;
    }

    const schema = node.getSchema();
    if (schema !== undefined) {
      const schemaResult: JsonObject = {};
      for (const [field, schemaNode] of schema.entries()) {
        schemaResult[field] = NodeToMapListOrValue.get(schemaNode, strategy);
      }
      const enumValues = schema.getEnum();
      if (enumValues !== undefined) {
        schemaResult.enum = enumValues.map((enumNode) =>
          NodeToMapListOrValue.get(enumNode, strategy),
        );
      }
      result[OBJECT_SCHEMA] = schemaResult;
    }

    const contracts = node.getContractsNode();
    if (contracts !== undefined) {
      result[OBJECT_CONTRACTS] = NodeToMapListOrValue.get(contracts, strategy);
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

  private static normalizeOptions(
    strategyOrOptions: Strategy | NodeToMapListOrValueOptions,
  ): Required<NodeToMapListOrValueOptions> {
    if (typeof strategyOrOptions === 'string') {
      return {
        strategy: strategyOrOptions,
      };
    }

    return {
      strategy: strategyOrOptions.strategy ?? 'official',
    };
  }
}
