import { BlueNode } from '../model/Node';
import { NodeToMapListOrValue } from './NodeToMapListOrValue';
import { Base58Sha256Provider } from './Base58Sha256Provider';
import { Base58XXHashProvider } from './Base58XXHashProvider';
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
  JsonPrimitive,
} from '@blue-company/shared-utils';
import { JsonBlueValue } from '../../schema';
import { default as Big } from 'big.js';

type NonNullableJsonPrimitive = NonNullable<JsonPrimitive>;
type NonNullableJsonObject = { [Key in string]: NonNullableJsonValue };
type NonNullableJsonArray =
  | NonNullableJsonValue[]
  | readonly NonNullableJsonValue[];
type NonNullableJsonValue =
  | NonNullableJsonPrimitive
  | NonNullableJsonObject
  | NonNullableJsonArray
  | Big;

const isNonNullableJsonPrimitive = (
  value: JsonBlueValue
): value is NonNullableJsonPrimitive => {
  return isJsonPrimitive(value) && isNonNullable(value);
};

type HashProvider = {
  apply: (object: JsonBlueValue) => Promise<string>;
  applySync: (object: JsonBlueValue) => string;
};

type SyncOrAsync<T> = T | Promise<T>;

export class BlueIdCalculator {
  public static INSTANCE = new BlueIdCalculator(new Base58Sha256Provider());

  private hashProvider: HashProvider;

  constructor(hashProvider: HashProvider) {
    this.hashProvider = hashProvider;
  }

  public static calculateBlueId(node: BlueNode) {
    return BlueIdCalculator.INSTANCE.calculate(NodeToMapListOrValue.get(node));
  }

  public static calculateBlueIdSync(node: BlueNode) {
    return BlueIdCalculator.INSTANCE.calculateSync(
      NodeToMapListOrValue.get(node)
    );
  }

  public static calculateBlueIdForNodes(nodes: BlueNode[]) {
    const objects = nodes.map((node) => NodeToMapListOrValue.get(node));
    return BlueIdCalculator.INSTANCE.calculate(objects);
  }

  public static calculateBlueIdSyncForNodes(nodes: BlueNode[]) {
    const objects = nodes.map((node) => NodeToMapListOrValue.get(node));
    return BlueIdCalculator.INSTANCE.calculateSync(objects);
  }

  public calculate(object: JsonBlueValue) {
    const cleanedObject = this.cleanStructure(object);
    if (cleanedObject === undefined) {
      throw new Error(`Object after cleaning cannot be null or undefined.`);
    }

    return this.internalCalculate(cleanedObject, false) as Promise<string>;
  }

  public calculateSync(object: JsonBlueValue) {
    const cleanedObject = this.cleanStructure(object);
    if (cleanedObject === undefined) {
      throw new Error(`Object after cleaning cannot be null or undefined.`);
    }

    return this.internalCalculate(cleanedObject, true) as string;
  }

  private internalCalculate(
    cleanedObject: NonNullableJsonValue,
    isSync: boolean
  ): SyncOrAsync<string> {
    if (
      isNonNullableJsonPrimitive(cleanedObject) ||
      isBigNumber(cleanedObject)
    ) {
      return this.applyHash(cleanedObject.toString(), isSync);
    } else if (Array.isArray(cleanedObject) || isReadonlyArray(cleanedObject)) {
      return this.calculateList(cleanedObject, isSync);
    } else {
      return this.calculateMap(cleanedObject, isSync);
    }
  }

  private calculateMap(map: NonNullableJsonObject, isSync: boolean) {
    if (map[OBJECT_BLUE_ID] !== undefined && map[OBJECT_BLUE_ID] !== null) {
      return map[OBJECT_BLUE_ID] as string;
    }

    const hashes: NonNullableJsonObject = {};
    const promises: Promise<void>[] = [];

    for (const key in map) {
      if ([OBJECT_NAME, OBJECT_VALUE, OBJECT_DESCRIPTION].includes(key)) {
        hashes[key] = map[key];
      } else {
        const calculateBlueId = () => {
          const result = this.internalCalculate(map[key], isSync);
          if (result instanceof Promise) {
            return result.then((blueId) => {
              hashes[key] = { blueId };
            });
          } else {
            hashes[key] = { blueId: result };
            return Promise.resolve();
          }
        };
        promises.push(calculateBlueId());
      }
    }

    if (isSync) {
      return this.applyHash(hashes, true);
    } else {
      return Promise.all(promises).then(() => this.applyHash(hashes, false));
    }
  }

  private calculateList(
    list: NonNullableJsonArray,
    isSync: boolean
  ): SyncOrAsync<string> {
    if (list.length === 1) {
      return this.internalCalculate(list[0], isSync);
    }

    const subList = list.slice(0, -1);
    const lastElement = list[list.length - 1];

    const calculateHashes = () => {
      const hashOfSubList = this.calculateList(subList, isSync);
      const hashOfLastElement = this.internalCalculate(lastElement, isSync);

      if (isSync) {
        return this.applyHash(
          [
            { blueId: hashOfSubList as string },
            { blueId: hashOfLastElement as string },
          ],
          true
        );
      } else {
        return Promise.all([hashOfSubList, hashOfLastElement]).then(
          ([subListHash, lastElementHash]) =>
            this.applyHash(
              [{ blueId: subListHash }, { blueId: lastElementHash }],
              false
            )
        );
      }
    };

    return calculateHashes();
  }

  private applyHash(value: NonNullableJsonValue, isSync: boolean) {
    return isSync
      ? this.hashProvider.applySync(value)
      : this.hashProvider.apply(value);
  }

  private cleanStructure(obj: JsonBlueValue): NonNullableJsonValue | undefined {
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
      const cleanedMap: NonNullableJsonObject = {};
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
