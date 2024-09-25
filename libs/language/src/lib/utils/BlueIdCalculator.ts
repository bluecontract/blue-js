import { BlueNode } from '../model/Node';
import { NodeToMapListOrValue } from './NodeToMapListOrValue';
import { Base58Sha256Provider } from './Base58Sha256Provider';
import {
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_NAME,
  OBJECT_VALUE,
} from './Properties';
import { isBigNumber } from '../../utils/typeGuards';
import {
  isJsonPrimitive,
  isNonNullable,
  isReadonlyArray,
} from '@blue-company/shared-utils';
import { JsonBlueArray, JsonBlueObject, JsonBlueValue } from '../../schema';

type HashProvider = { apply: (object: JsonBlueValue) => Promise<string> };

export class BlueIdCalculator {
  public static INSTANCE = new BlueIdCalculator(new Base58Sha256Provider());

  private hashProvider: HashProvider;

  constructor(hashProvider: HashProvider) {
    this.hashProvider = hashProvider;
  }

  public static async calculateBlueId(node: BlueNode) {
    return BlueIdCalculator.INSTANCE.calculate(NodeToMapListOrValue.get(node));
  }

  public static async calculateBlueIdForNodes(nodes: BlueNode[]) {
    const objects = nodes.map((node) => NodeToMapListOrValue.get(node));
    return BlueIdCalculator.INSTANCE.calculate(objects);
  }

  public async calculate(object: JsonBlueValue) {
    const cleanedObject = this.cleanStructure(object);

    if (cleanedObject === undefined) {
      throw new Error(
        `Object after cleaning cannot be null or undefined object.`
      );
    }

    if (isJsonPrimitive(cleanedObject) || isBigNumber(cleanedObject)) {
      return this.hashProvider.apply(cleanedObject.toString());
    } else if (Array.isArray(cleanedObject) || isReadonlyArray(cleanedObject)) {
      return this.calculateList(cleanedObject);
    } else {
      return this.calculateMap(cleanedObject);
    }
    throw new Error(
      `Object must be a String, Number, Boolean, List or Map - found ${typeof object}`
    );
  }

  private async calculateMap(map: JsonBlueObject) {
    if (map[OBJECT_BLUE_ID] !== undefined && map[OBJECT_BLUE_ID] !== null) {
      return map[OBJECT_BLUE_ID] as string;
    }

    const hashes = {} as JsonBlueObject;
    for (const key in map) {
      if ([OBJECT_NAME, OBJECT_VALUE, OBJECT_DESCRIPTION].includes(key)) {
        hashes[key] = map[key];
      } else {
        hashes[key] = await this.calculate(map[key]);
      }
    }

    return this.hashProvider.apply(hashes);
  }

  private async calculateList(list: JsonBlueArray): Promise<string> {
    if (list.length === 1) {
      return this.calculate(list[0]);
    }

    const subList = list.slice(0, -1);
    const hashOfSubList = await this.calculateList(subList);

    const lastElement = list[list.length - 1];
    const hashOfLastElement = await this.calculate(lastElement);

    return this.hashProvider.apply([hashOfSubList, hashOfLastElement]);
  }

  private cleanStructure(
    obj: JsonBlueValue
  ): NonNullable<JsonBlueValue> | undefined {
    if (obj === null || obj === undefined) {
      return undefined;
    } else if (isJsonPrimitive(obj) || isBigNumber(obj)) {
      return obj;
    } else if (Array.isArray(obj) || isReadonlyArray(obj)) {
      const cleanedList = obj
        .map((item) => this.cleanStructure(item))
        .filter(isNonNullable);

      return cleanedList.length > 0 ? cleanedList : undefined;
    } else if (typeof obj === 'object') {
      const cleanedMap: JsonBlueObject = {};
      for (const key in obj) {
        const cleanedValue = this.cleanStructure(obj[key]);
        if (cleanedValue !== null && cleanedValue !== undefined) {
          cleanedMap[key] = cleanedValue;
        }
      }
      return Object.keys(cleanedMap).length > 0 ? cleanedMap : undefined;
    } else {
      return obj;
    }
  }
}
