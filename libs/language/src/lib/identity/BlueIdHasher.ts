import { isJsonPrimitive, JsonPrimitive } from '@blue-labs/shared-utils';
import Big from 'big.js';
import { JsonBlueValue } from '../../schema';
import { isBigIntegerNumber, isBigNumber } from '../../utils/typeGuards';
import { BigDecimalNumber } from '../model/BigDecimalNumber';
import { BigIntegerNumber } from '../model/BigIntegerNumber';
import { BlueNode } from '../model/Node';
import { LIST_POSITION_KEY, LIST_PREVIOUS_KEY } from '../utils/ListControls';
import {
  OBJECT_BLUE,
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_ITEMS,
  OBJECT_ITEM_TYPE,
  OBJECT_KEY_TYPE,
  OBJECT_NAME,
  OBJECT_TYPE,
  OBJECT_VALUE,
  OBJECT_VALUE_TYPE,
  TEXT_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
} from '../utils/Properties';

type HashProvider = {
  apply: (object: JsonBlueValue) => Promise<string>;
  applySync: (object: JsonBlueValue) => string;
};

type SyncOrAsync<T> = T | Promise<T>;

type HashScalar = Exclude<JsonPrimitive, null> | Big;
type HashValue = HashScalar | HashValue[] | { [key: string]: HashValue };

const HASH_INLINE_KEYS = new Set([
  OBJECT_NAME,
  OBJECT_DESCRIPTION,
  OBJECT_VALUE,
]);

const LIST_EMPTY_HASH_INPUT = { $list: 'empty' } as const;
const LIST_CONS_KEY = '$listCons';
const LIST_FOLD_PREVIOUS_KEY = 'prev';
const LIST_ELEMENT_KEY = 'elem';

export class BlueIdHasher {
  constructor(private readonly hashProvider: HashProvider) {}

  public calculate(input: JsonBlueValue | BlueNode | BlueNode[]) {
    const cleaned = this.clean(this.toHashValue(input));
    if (cleaned === undefined) {
      throw new Error('Object after cleaning cannot be null or undefined.');
    }

    return this.calculateInternal(cleaned, false) as Promise<string>;
  }

  public calculateSync(input: JsonBlueValue | BlueNode | BlueNode[]) {
    const cleaned = this.clean(this.toHashValue(input));
    if (cleaned === undefined) {
      throw new Error('Object after cleaning cannot be null or undefined.');
    }

    return this.calculateInternal(cleaned, true) as string;
  }

  private calculateInternal(
    value: HashValue,
    isSync: boolean,
  ): SyncOrAsync<string> {
    if (this.isScalar(value)) {
      return this.applyHash(this.toJsonScalar(value), isSync);
    }

    if (Array.isArray(value)) {
      return this.calculateList(value, isSync);
    }

    if (this.isPureReference(value)) {
      return value[OBJECT_BLUE_ID] as string;
    }

    if (this.isScalarWrapper(value)) {
      return this.calculateInternal(value[OBJECT_VALUE], isSync);
    }

    if (this.isBasicTypedScalarWrapper(value)) {
      return this.calculateInternal(value[OBJECT_VALUE], isSync);
    }

    if (this.isListWrapper(value)) {
      return this.calculateInternal(value[OBJECT_ITEMS], isSync);
    }

    if (this.isBasicTypedListWrapper(value)) {
      return this.calculateInternal(value[OBJECT_ITEMS], isSync);
    }

    return this.calculateMap(value, isSync);
  }

  private calculateMap(
    map: { [key: string]: HashValue },
    isSync: boolean,
  ): SyncOrAsync<string> {
    const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    const hashEntries: SyncOrAsync<[string, HashValue]>[] = entries.map(
      ([key, value]) => {
        if (HASH_INLINE_KEYS.has(key)) {
          return isSync ? [key, value] : Promise.resolve([key, value]);
        }

        const hashedValue = this.calculateInternal(value, isSync);
        if (isSync) {
          return [key, { [OBJECT_BLUE_ID]: hashedValue as string }];
        }

        return Promise.resolve(hashedValue).then((blueId) => [
          key,
          { [OBJECT_BLUE_ID]: blueId },
        ]);
      },
    );

    const processEntries = (resolvedEntries: [string, HashValue][]) => {
      const hashInput: { [key: string]: HashValue } = {};
      for (const [key, value] of resolvedEntries) {
        hashInput[key] = value;
      }
      return this.applyHash(hashInput as JsonBlueValue, isSync);
    };

    return isSync
      ? processEntries(hashEntries as [string, HashValue][])
      : Promise.all(hashEntries).then(processEntries);
  }

  private calculateList(
    list: HashValue[],
    isSync: boolean,
  ): SyncOrAsync<string> {
    let startIndex = 0;
    let accumulatedHash: SyncOrAsync<string>;
    const firstItem = list[0];
    if (firstItem !== undefined && this.hasPreviousControlKey(firstItem)) {
      // Low-level trusted-minimal behavior only. Public semantic identity must
      // verify or consume $previous before reaching this hasher.
      const previousBlueId = this.getPreviousControlBlueId(firstItem);
      if (previousBlueId === undefined) {
        throw new Error(
          '$previous list control must be exactly { $previous: { blueId: <id> } }.',
        );
      }
      accumulatedHash = isSync
        ? previousBlueId
        : Promise.resolve(previousBlueId);
      startIndex = 1;
    } else {
      accumulatedHash = this.applyHash(LIST_EMPTY_HASH_INPUT, isSync);
    }

    for (let i = startIndex; i < list.length; i++) {
      const item = list[i];
      if (this.hasPreviousControlKey(item)) {
        throw new Error('$previous list control is allowed only first.');
      }
      if (this.hasPositionControlKey(item)) {
        throw new Error(
          '$pos list controls must be consumed before raw BlueId hashing.',
        );
      }
      const previousHash = accumulatedHash;
      const itemHash = this.calculateInternal(item, isSync);
      if (isSync) {
        accumulatedHash = this.applyHash(
          this.createListFoldInput(previousHash as string, itemHash as string),
          true,
        ) as string;
      } else {
        accumulatedHash = Promise.all([previousHash, itemHash]).then(
          ([prev, elem]) =>
            this.applyHash(this.createListFoldInput(prev, elem), false),
        );
      }
    }

    return accumulatedHash;
  }

  private createListFoldInput(prev: string, elem: string): JsonBlueValue {
    return {
      [LIST_CONS_KEY]: {
        [LIST_FOLD_PREVIOUS_KEY]: { [OBJECT_BLUE_ID]: prev },
        [LIST_ELEMENT_KEY]: { [OBJECT_BLUE_ID]: elem },
      },
    };
  }

  private getPreviousControlBlueId(value: HashValue): string | undefined {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      isBigNumber(value)
    ) {
      return undefined;
    }

    const entries = Object.entries(value);
    if (entries.length !== 1 || entries[0][0] !== LIST_PREVIOUS_KEY) {
      return undefined;
    }

    const previous = entries[0][1];
    if (
      typeof previous !== 'object' ||
      previous === null ||
      Array.isArray(previous) ||
      isBigNumber(previous) ||
      !this.isPureReference(previous)
    ) {
      return undefined;
    }

    return previous[OBJECT_BLUE_ID] as string;
  }

  private hasPreviousControlKey(value: HashValue): boolean {
    return this.hasControlKey(value, LIST_PREVIOUS_KEY);
  }

  private hasPositionControlKey(value: HashValue): boolean {
    return this.hasControlKey(value, LIST_POSITION_KEY);
  }

  private hasControlKey(value: HashValue, key: string): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      !isBigNumber(value) &&
      Object.prototype.hasOwnProperty.call(value, key)
    );
  }

  private applyHash(value: JsonBlueValue, isSync: boolean) {
    return isSync
      ? this.hashProvider.applySync(value)
      : this.hashProvider.apply(value);
  }

  private toHashValue(
    input: JsonBlueValue | BlueNode | BlueNode[],
  ): HashValue | undefined {
    if (input instanceof BlueNode) {
      return this.nodeToHashValue(input);
    }

    if (Array.isArray(input)) {
      return input
        .map((item) => this.toHashValue(item as JsonBlueValue))
        .filter((item): item is HashValue => item !== undefined);
    }

    return this.jsonToHashValue(input);
  }

  private nodeToHashValue(node: BlueNode): HashValue {
    const map: { [key: string]: HashValue } = {};

    this.setIfPresent(map, OBJECT_NAME, node.getName());
    this.setIfPresent(map, OBJECT_DESCRIPTION, node.getDescription());
    this.setIfPresent(map, OBJECT_TYPE, node.getType());
    this.setIfPresent(map, OBJECT_ITEM_TYPE, node.getItemType());
    this.setIfPresent(map, OBJECT_KEY_TYPE, node.getKeyType());
    this.setIfPresent(map, OBJECT_VALUE_TYPE, node.getValueType());

    const value = node.getValue();
    if (value !== undefined) {
      map[OBJECT_VALUE] = this.scalarToHashValue(value);
    }

    const items = node.getItems();
    if (items !== undefined) {
      map[OBJECT_ITEMS] = items.map((item) => this.nodeToHashValue(item));
    }

    this.setIfPresent(map, OBJECT_BLUE_ID, node.getReferenceBlueId());
    this.setIfPresent(map, OBJECT_BLUE, node.getBlue());

    const properties = node.getProperties();
    if (properties !== undefined) {
      for (const [key, property] of Object.entries(properties)) {
        map[key] = this.nodeToHashValue(property);
      }
    }

    return map;
  }

  private jsonToHashValue(value: JsonBlueValue): HashValue | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (this.isScalar(value) || isBigNumber(value)) {
      return this.scalarToHashValue(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.jsonToHashValue(item as JsonBlueValue))
        .filter((item): item is HashValue => item !== undefined);
    }

    if (typeof value === 'object') {
      const result: { [key: string]: HashValue | undefined } = {};
      for (const [key, child] of Object.entries(value)) {
        result[key] = this.jsonToHashValue(child as JsonBlueValue);
      }
      return result as HashValue;
    }

    return value;
  }

  private setIfPresent(
    target: { [key: string]: HashValue },
    key: string,
    value: BlueNode | string | undefined,
  ): void {
    if (value === undefined) {
      return;
    }

    target[key] =
      value instanceof BlueNode ? this.nodeToHashValue(value) : value;
  }

  private clean(value: HashValue | undefined): HashValue | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (this.isScalar(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.clean(item))
        .filter((item): item is HashValue => item !== undefined);
    }

    const cleaned: { [key: string]: HashValue } = {};
    for (const [key, child] of Object.entries(value)) {
      const cleanedChild = this.clean(child);
      if (cleanedChild !== undefined) {
        cleaned[key] = cleanedChild;
      }
    }

    return Object.keys(cleaned).length === 0 ? undefined : cleaned;
  }

  private isPureReference(value: { [key: string]: HashValue }): boolean {
    const entries = Object.entries(value);
    return (
      entries.length === 1 &&
      entries[0]?.[0] === OBJECT_BLUE_ID &&
      typeof entries[0]?.[1] === 'string'
    );
  }

  private isScalarWrapper(value: { [key: string]: HashValue }): boolean {
    const entries = Object.entries(value);
    return entries.length === 1 && entries[0]?.[0] === OBJECT_VALUE;
  }

  private isBasicTypedScalarWrapper(value: {
    [key: string]: HashValue;
  }): boolean {
    return (
      this.hasOnlyKeys(value, [OBJECT_TYPE, OBJECT_VALUE]) &&
      this.isBasicScalarTypeReference(value[OBJECT_TYPE])
    );
  }

  private isListWrapper(value: { [key: string]: HashValue }): boolean {
    const entries = Object.entries(value);
    return (
      entries.length === 1 &&
      entries[0]?.[0] === OBJECT_ITEMS &&
      Array.isArray(entries[0]?.[1])
    );
  }

  private isBasicTypedListWrapper(value: {
    [key: string]: HashValue;
  }): boolean {
    return (
      this.hasOnlyKeys(value, [OBJECT_TYPE, OBJECT_ITEMS]) &&
      this.isTypeReference(value[OBJECT_TYPE], LIST_TYPE_BLUE_ID) &&
      Array.isArray(value[OBJECT_ITEMS])
    );
  }

  private hasOnlyKeys(
    value: { [key: string]: HashValue },
    expectedKeys: string[],
  ): boolean {
    const keys = Object.keys(value);
    return (
      keys.length === expectedKeys.length &&
      expectedKeys.every((key) =>
        Object.prototype.hasOwnProperty.call(value, key),
      )
    );
  }

  private isBasicScalarTypeReference(value: HashValue | undefined): boolean {
    return (
      this.isTypeReference(value, TEXT_TYPE_BLUE_ID) ||
      this.isTypeReference(value, INTEGER_TYPE_BLUE_ID) ||
      this.isTypeReference(value, DOUBLE_TYPE_BLUE_ID) ||
      this.isTypeReference(value, BOOLEAN_TYPE_BLUE_ID)
    );
  }

  private isTypeReference(
    value: HashValue | undefined,
    blueId: string,
  ): boolean {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      isBigNumber(value)
    ) {
      return false;
    }

    return this.isPureReference(value) && value[OBJECT_BLUE_ID] === blueId;
  }

  private isScalar(value: unknown): value is HashScalar {
    return (isJsonPrimitive(value) && value !== null) || isBigNumber(value);
  }

  private scalarToHashValue(value: unknown): HashScalar {
    if (value instanceof BigIntegerNumber || isBigIntegerNumber(value)) {
      const lowerBound = new Big(Number.MIN_SAFE_INTEGER.toString());
      const upperBound = new Big(Number.MAX_SAFE_INTEGER.toString());
      if (value.lt(lowerBound) || value.gt(upperBound)) {
        return value.toString() as HashScalar;
      }
      return value.toNumber() as HashScalar;
    }

    if (value instanceof BigDecimalNumber || isBigNumber(value)) {
      return value.toNumber() as HashScalar;
    }

    return value as HashScalar;
  }

  private toJsonScalar(value: HashScalar): JsonBlueValue {
    if (isBigNumber(value)) {
      return this.scalarToHashValue(value) as JsonBlueValue;
    }
    return value as JsonBlueValue;
  }
}
