import {
  isJsonPrimitive,
  isNonNullable,
  isReadonlyArray,
  JsonPrimitive,
} from '@blue-labs/shared-utils';
import { JsonBlueValue } from '../../../schema';
import { isBigNumber } from '../../../utils/typeGuards';
import { Base58Sha256Provider } from '../Base58Sha256Provider';
import {
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_NAME,
  OBJECT_VALUE,
} from '../Properties';
import { BlueIdHashValue } from './types';
import { SpecCanonicalNormalizer } from './SpecCanonicalNormalizer';

type NonNullableJsonPrimitive = NonNullable<JsonPrimitive>;
type NonNullableJsonObject = { [Key in string]: BlueIdHashValue };
type NonNullableJsonArray = BlueIdHashValue[] | readonly BlueIdHashValue[];
type HashValue = BlueIdHashValue | { blueId: string };
type SyncOrAsync<T> = T | Promise<T>;

type HashProvider = {
  apply: (object: JsonBlueValue) => Promise<string>;
  applySync: (object: JsonBlueValue) => string;
};

const isNonNullableJsonPrimitive = (
  value: JsonBlueValue,
): value is NonNullableJsonPrimitive => {
  return isJsonPrimitive(value) && isNonNullable(value);
};

export class SemanticBlueIdHasher {
  public static INSTANCE = new SemanticBlueIdHasher(new Base58Sha256Provider());
  private hashProvider: HashProvider;

  constructor(hashProvider: HashProvider) {
    this.hashProvider = hashProvider;
  }

  public async calculate(object: JsonBlueValue): Promise<string> {
    const normalized = SpecCanonicalNormalizer.normalize(object);
    return this.internalCalculate(normalized, false) as Promise<string>;
  }

  public calculateSync(object: JsonBlueValue): string {
    const normalized = SpecCanonicalNormalizer.normalize(object);
    return this.internalCalculate(normalized, true) as string;
  }

  private internalCalculate(
    cleanedObject: BlueIdHashValue,
    isSync: boolean,
  ): SyncOrAsync<string> {
    if (
      isNonNullableJsonPrimitive(cleanedObject) ||
      isBigNumber(cleanedObject)
    ) {
      return this.applyHash(cleanedObject.toString(), isSync);
    } else if (Array.isArray(cleanedObject) || isReadonlyArray(cleanedObject)) {
      return this.calculateList(cleanedObject as NonNullableJsonArray, isSync);
    } else {
      return this.calculateMap(cleanedObject as NonNullableJsonObject, isSync);
    }
  }

  private calculateMap(
    map: NonNullableJsonObject,
    isSync: boolean,
  ): SyncOrAsync<string> {
    const isPureBlueIdReference = this.isPureBlueIdReference(map);
    if (isPureBlueIdReference) {
      return map[OBJECT_BLUE_ID] as string;
    }

    const keys = Object.keys(map).filter((key) => key !== OBJECT_BLUE_ID);
    const hashPromises: SyncOrAsync<[string, HashValue]>[] = keys.map((key) => {
      const value = map[key];
      if ([OBJECT_NAME, OBJECT_VALUE, OBJECT_DESCRIPTION].includes(key)) {
        return isSync ? [key, value] : Promise.resolve([key, value]);
      }

      const hashedValue = this.internalCalculate(value, isSync);
      if (isSync) {
        return [key, { blueId: hashedValue as string }];
      }
      return Promise.resolve(hashedValue).then((hv) => [key, { blueId: hv }]);
    });

    const processHashes = (entries: [string, HashValue][]) => {
      const hashes: NonNullableJsonObject = {};
      for (const [key, hashValue] of entries) {
        hashes[key] = hashValue;
      }
      return this.applyHash(hashes, isSync);
    };

    if (isSync) {
      return processHashes(hashPromises as [string, HashValue][]);
    }
    return Promise.all(hashPromises).then(processHashes);
  }

  private calculateList(
    list: NonNullableJsonArray,
    isSync: boolean,
  ): SyncOrAsync<string> {
    if (list.length === 0) {
      return this.applyHash([], isSync);
    }

    let accumulatedHash: SyncOrAsync<string> = this.internalCalculate(
      list[0],
      isSync,
    );

    const combineTwoHashes = (
      hash1: SyncOrAsync<string>,
      hash2: SyncOrAsync<string>,
    ): SyncOrAsync<string> => {
      if (isSync) {
        return this.applyHash(
          [{ blueId: hash1 as string }, { blueId: hash2 as string }],
          true,
        ) as string;
      }
      return Promise.all([hash1, hash2]).then(([h1, h2]) =>
        this.applyHash([{ blueId: h1 }, { blueId: h2 }], false),
      );
    };

    for (let i = 1; i < list.length; i++) {
      const elementHash = this.internalCalculate(list[i], isSync);
      accumulatedHash = combineTwoHashes(accumulatedHash, elementHash);
    }

    return accumulatedHash;
  }

  private applyHash(value: BlueIdHashValue, isSync: boolean) {
    return isSync
      ? this.hashProvider.applySync(value)
      : this.hashProvider.apply(value);
  }

  private isPureBlueIdReference(map: NonNullableJsonObject): boolean {
    const keys = Object.keys(map);
    if (keys.length !== 1) {
      return false;
    }
    if (keys[0] !== OBJECT_BLUE_ID) {
      return false;
    }
    return typeof map[OBJECT_BLUE_ID] === 'string';
  }
}
