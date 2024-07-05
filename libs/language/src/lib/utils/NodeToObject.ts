import { JsonObject, JsonValue } from 'type-fest';
import { BlueNode } from '../model/Node';
import {
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_ITEMS,
  OBJECT_NAME,
  OBJECT_REF,
  OBJECT_TYPE,
  OBJECT_VALUE,
} from './Properties';
import { isBigNumber } from '../../utils/typeGuards';

export type Strategy = 'standard' | 'domainMapping';

export class NodeToObject {
  static get(node: BlueNode, strategy: Strategy = 'standard'): JsonValue {
    const value = this.serializeValue(node.getValue());
    if (value !== undefined && strategy === 'domainMapping') {
      return value;
    }

    const items = node
      .getItems()
      ?.map((item) => NodeToObject.get(item, strategy));

    if (items !== undefined && strategy === 'domainMapping') {
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
    if (type !== undefined) {
      result[OBJECT_TYPE] = NodeToObject.get(type);
    }

    if (value !== undefined) {
      result[OBJECT_VALUE] = value;
    }

    if (items !== undefined) {
      result[OBJECT_ITEMS] = items;
    }

    const ref = node.getRef();
    if (ref !== undefined) {
      result[OBJECT_REF] = ref;
    }

    const blueId = node.getBlueId();
    if (blueId !== undefined) {
      result[OBJECT_BLUE_ID] = blueId;
    }

    if (node.getConstraints() !== undefined) {
      // TODO: implement constraints
    }

    const properties = node.getProperties();
    if (properties !== undefined) {
      Object.entries(properties).forEach(([key, value]) => {
        result[key] = NodeToObject.get(value, strategy);
      });
    }

    return result;
  }

  private static serializeValue(value: BlueNode['value']) {
    if (isBigNumber(value)) {
      return value.toNumber();
    }
    return value;
  }
}
