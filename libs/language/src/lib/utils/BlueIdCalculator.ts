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
  JsonPrimitive,
} from '@blue-labs/shared-utils';
import { JsonBlueValue } from '../../schema';
import { default as Big } from 'big.js';

// Type definitions for non-nullable JSON values
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

// Type guard to check for non-nullable JSON primitives
const isNonNullableJsonPrimitive = (
  value: JsonBlueValue
): value is NonNullableJsonPrimitive => {
  return isJsonPrimitive(value) && isNonNullable(value);
};

type HashProvider = {
  apply: (object: JsonBlueValue) => Promise<string>;
  applySync: (object: JsonBlueValue) => string;
};

// Utility type to handle synchronous or asynchronous return types
type SyncOrAsync<T> = T | Promise<T>;

// Type to represent the value associated with a key in the hash computation
type HashValue = NonNullableJsonValue | { blueId: string };

export class BlueIdCalculator {
  public static INSTANCE = new BlueIdCalculator(new Base58Sha256Provider());

  private hashProvider: HashProvider;

  constructor(hashProvider: HashProvider) {
    this.hashProvider = hashProvider;
  }

  public static calculateBlueId(node: BlueNode | BlueNode[]) {
    if (Array.isArray(node)) {
      const nodes = node.map((n) => NodeToMapListOrValue.get(n));
      return BlueIdCalculator.INSTANCE.calculate(nodes);
    }

    const object = NodeToMapListOrValue.get(node);
    return BlueIdCalculator.INSTANCE.calculate(object);
  }

  public static calculateBlueIdSync(node: BlueNode | BlueNode[]) {
    if (Array.isArray(node)) {
      const nodes = node.map((n) => NodeToMapListOrValue.get(n));
      return BlueIdCalculator.INSTANCE.calculateSync(nodes);
    }

    const object = NodeToMapListOrValue.get(node);
    return BlueIdCalculator.INSTANCE.calculateSync(object);
  }

  // public static calculateBlueIdForNodes(nodes: BlueNode[]) {
  //   const objects = nodes.map((node) => NodeToMapListOrValue.get(node));
  //   return BlueIdCalculator.INSTANCE.calculate(objects);
  // }

  // public static calculateBlueIdSyncForNodes(nodes: BlueNode[]) {
  //   const objects = nodes.map((node) => NodeToMapListOrValue.get(node));
  //   return BlueIdCalculator.INSTANCE.calculateSync(objects);
  // }

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

  // Internal method to calculate BlueId recursively
  private internalCalculate(
    cleanedObject: NonNullableJsonValue,
    isSync: boolean
  ): SyncOrAsync<string> {
    if (
      isNonNullableJsonPrimitive(cleanedObject) ||
      isBigNumber(cleanedObject)
    ) {
      // Base case: primitive or Big number, convert to string and hash
      return this.applyHash(cleanedObject.toString(), isSync);
    } else if (Array.isArray(cleanedObject) || isReadonlyArray(cleanedObject)) {
      // Handle arrays
      return this.calculateList(cleanedObject, isSync);
    } else {
      // Handle objects (maps)
      return this.calculateMap(cleanedObject, isSync);
    }
  }

  private calculateMap(
    map: NonNullableJsonObject,
    isSync: boolean
  ): SyncOrAsync<string> {
    // If the object already has a BlueId, return it
    if (map[OBJECT_BLUE_ID] !== undefined) {
      return map[OBJECT_BLUE_ID] as string;
    }

    const keys = Object.keys(map);

    // Prepare an array to collect hash computations for each key-value pair
    const hashPromises: SyncOrAsync<[string, HashValue]>[] = keys.map((key) => {
      const value = map[key];

      // If the key is one of the specified properties, use the value directly
      if ([OBJECT_NAME, OBJECT_VALUE, OBJECT_DESCRIPTION].includes(key)) {
        return isSync ? [key, value] : Promise.resolve([key, value]);
      } else {
        // Recursively compute the BlueId of the value
        const hashedValue = this.internalCalculate(value, isSync);
        if (isSync) {
          return [key, { blueId: hashedValue as string }];
        } else {
          // For async, resolve the promise and return the key-hash pair
          return Promise.resolve(hashedValue).then((hv) => [
            key,
            { blueId: hv },
          ]);
        }
      }
    });

    // Function to process all hash computations and combine them
    const processHashes = (entries: [string, HashValue][]) => {
      const hashes: NonNullableJsonObject = {};
      for (const [key, hashValue] of entries) {
        hashes[key] = hashValue;
      }
      return this.applyHash(hashes, isSync);
    };

    if (isSync) {
      return processHashes(hashPromises as [string, HashValue][]);
    } else {
      return Promise.all(hashPromises).then(processHashes);
    }
  }

  private calculateList(
    list: NonNullableJsonArray,
    isSync: boolean
  ): SyncOrAsync<string> {
    if (list.length === 0) {
      throw new Error('Cannot calculate BlueId for an empty list.');
    }

    // Start with the hash of the first element
    let accumulatedHash: SyncOrAsync<string> = this.internalCalculate(
      list[0],
      isSync
    );

    // Function to combine two hashes
    const combineTwoHashes = (
      hash1: SyncOrAsync<string>,
      hash2: SyncOrAsync<string>
    ): SyncOrAsync<string> => {
      if (isSync) {
        return this.applyHash(
          [{ blueId: hash1 as string }, { blueId: hash2 as string }],
          true
        ) as string;
      } else {
        return Promise.all([hash1, hash2]).then(([h1, h2]) =>
          this.applyHash([{ blueId: h1 }, { blueId: h2 }], false)
        );
      }
    };

    // Iteratively combine the hashes of the list elements
    for (let i = 1; i < list.length; i++) {
      const elementHash = this.internalCalculate(list[i], isSync);
      accumulatedHash = combineTwoHashes(accumulatedHash, elementHash);
    }

    return accumulatedHash;
  }

  // Method to apply the hash provider to a value
  private applyHash(value: NonNullableJsonValue, isSync: boolean) {
    return isSync
      ? this.hashProvider.applySync(value)
      : this.hashProvider.apply(value);
  }

  // Method to clean the input structure by removing null or undefined values
  private cleanStructure(obj: JsonBlueValue): NonNullableJsonValue | undefined {
    if (obj === null || obj === undefined) {
      return undefined;
    } else if (isJsonPrimitive(obj) || isBigNumber(obj)) {
      return obj;
    } else if (Array.isArray(obj) || isReadonlyArray(obj)) {
      // Recursively clean each item in the array
      const cleanedList = obj
        .map((item) => this.cleanStructure(item))
        .filter(isNonNullable);

      return cleanedList.length > 0 ? cleanedList : undefined;
    } else if (typeof obj === 'object') {
      // Recursively clean each key-value pair in the object
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
