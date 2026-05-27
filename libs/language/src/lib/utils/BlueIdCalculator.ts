import { JsonBlueValue } from '../../schema';
import { NodeDeserializer } from '../model';
import { BlueNode } from '../model/Node';
import { Base58Sha256Provider } from './Base58Sha256Provider';
import { BlueIdInputValue, NodeToBlueIdInput } from './NodeToBlueIdInput';
import {
  LIST_CONTROL_PREVIOUS,
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_NAME,
  OBJECT_VALUE,
} from './Properties';

type HashProvider = {
  apply: (object: JsonBlueValue) => Promise<string>;
  applySync: (object: JsonBlueValue) => string;
};

type HashValue =
  | string
  | number
  | boolean
  | HashValue[]
  | { [key: string]: HashValue };

type SyncOrAsync<T> = T | Promise<T>;

const INLINE_KEYS = new Set([OBJECT_NAME, OBJECT_DESCRIPTION, OBJECT_VALUE]);

export class BlueIdCalculator {
  public static INSTANCE = new BlueIdCalculator(new Base58Sha256Provider());

  constructor(private readonly hashProvider: HashProvider) {}

  public static calculateBlueId(node: BlueNode | BlueNode[]) {
    return BlueIdCalculator.INSTANCE.calculate(node);
  }

  public static calculateBlueIdSync(node: BlueNode | BlueNode[]) {
    return BlueIdCalculator.INSTANCE.calculateSync(node);
  }

  public static calculateBlueIdAllowingCyclicPlaceholdersSync(
    node: JsonBlueValue | BlueNode | BlueNode[],
  ) {
    return BlueIdCalculator.INSTANCE.calculateAllowingCyclicPlaceholdersSync(
      node,
    );
  }

  public static calculateBlueIdWithResolvedBlueIdMetadataSync(node: BlueNode) {
    return BlueIdCalculator.INSTANCE.calculateInput(
      NodeToBlueIdInput.getWithResolvedBlueIdMetadata(node),
      true,
    ) as string;
  }

  public static calculateBlueIdInputSync(input: BlueIdInputValue): string {
    return BlueIdCalculator.INSTANCE.calculateInput(input, true) as string;
  }

  public calculate(object: JsonBlueValue | BlueNode | BlueNode[]) {
    return this.calculateInput(
      this.prepareInput(object),
      false,
    ) as Promise<string>;
  }

  public calculateSync(object: JsonBlueValue | BlueNode | BlueNode[]) {
    return this.calculateInput(this.prepareInput(object), true) as string;
  }

  public calculateAllowingCyclicPlaceholdersSync(
    object: JsonBlueValue | BlueNode | BlueNode[],
  ): string {
    return this.calculateInput(
      this.prepareInputAllowingCyclicPlaceholders(object),
      true,
    ) as string;
  }

  private prepareInput(
    object: JsonBlueValue | BlueNode | BlueNode[],
  ): BlueIdInputValue {
    if (object instanceof BlueNode) {
      return NodeToBlueIdInput.get(object);
    }
    if (
      Array.isArray(object) &&
      object.every((item) => item instanceof BlueNode)
    ) {
      return object.map((node, index) =>
        NodeToBlueIdInput.getListElement(node, index),
      );
    }
    return NodeToBlueIdInput.get(NodeDeserializer.deserialize(object));
  }

  private prepareInputAllowingCyclicPlaceholders(
    object: JsonBlueValue | BlueNode | BlueNode[],
  ): BlueIdInputValue {
    if (object instanceof BlueNode) {
      return NodeToBlueIdInput.getAllowingCyclicPlaceholders(object);
    }
    if (
      Array.isArray(object) &&
      object.every((item) => item instanceof BlueNode)
    ) {
      return object.map((node, index) =>
        NodeToBlueIdInput.getListElementAllowingCyclicPlaceholders(node, index),
      );
    }
    return NodeToBlueIdInput.getAllowingCyclicPlaceholders(
      NodeDeserializer.deserialize(object),
    );
  }

  private calculateInput(
    input: BlueIdInputValue,
    isSync: boolean,
  ): SyncOrAsync<string> {
    return this.calculateCleaned(this.cleanRoot(input), isSync);
  }

  private calculateCleaned(
    value: HashValue,
    isSync: boolean,
  ): SyncOrAsync<string> {
    if (this.isScalar(value)) {
      return this.applyHash(value, isSync);
    }
    if (Array.isArray(value)) {
      return this.calculateList(value, isSync);
    }
    return this.calculateMap(value, isSync);
  }

  private calculateMap(
    map: { [key: string]: HashValue },
    isSync: boolean,
  ): SyncOrAsync<string> {
    if (
      Object.keys(map).length === 1 &&
      typeof map[OBJECT_BLUE_ID] === 'string'
    ) {
      return map[OBJECT_BLUE_ID] as string;
    }

    const entries = Object.keys(map)
      .sort()
      .map((key): SyncOrAsync<[string, JsonBlueValue]> => {
        const value = map[key];
        if (INLINE_KEYS.has(key)) {
          return [key, value as JsonBlueValue];
        }
        const blueId = this.calculateCleaned(value, isSync);
        if (isSync) {
          return [key, { [OBJECT_BLUE_ID]: blueId as string }];
        }
        return Promise.resolve(blueId).then((resolved) => [
          key,
          { [OBJECT_BLUE_ID]: resolved },
        ]);
      });

    if (isSync) {
      return this.applyHash(
        Object.fromEntries(entries as [string, JsonBlueValue][]),
        true,
      );
    }

    return Promise.all(entries).then((resolvedEntries) =>
      this.applyHash(Object.fromEntries(resolvedEntries), false),
    );
  }

  private calculateList(
    list: HashValue[],
    isSync: boolean,
  ): SyncOrAsync<string> {
    let accumulator: SyncOrAsync<string>;
    let start = 0;
    if (list.length > 0 && this.isPreviousControl(list[0])) {
      accumulator = this.previousBlueId(list[0]);
      start = 1;
    } else {
      accumulator = this.applyHash({ $list: 'empty' }, isSync);
    }

    for (let index = start; index < list.length; index += 1) {
      const previous = accumulator;
      const elementBlueId = this.calculateCleaned(list[index], isSync);
      if (isSync) {
        accumulator = this.applyHash(
          this.listCons(previous as string, elementBlueId as string),
          true,
        );
      } else {
        accumulator = Promise.all([previous, elementBlueId]).then(
          ([prev, elem]) => this.applyHash(this.listCons(prev, elem), false),
        );
      }
    }

    return accumulator;
  }

  private listCons(previous: string, element: string): JsonBlueValue {
    return {
      $listCons: {
        elem: { [OBJECT_BLUE_ID]: element },
        prev: { [OBJECT_BLUE_ID]: previous },
      },
    };
  }

  private cleanRoot(value: BlueIdInputValue): HashValue {
    if (value === null || value === undefined) {
      throw new Error('Root null is not valid BlueId input.');
    }
    if (this.isScalar(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.cleanRoot(item));
    }
    const cleaned: { [key: string]: HashValue } = {};
    for (const [key, child] of Object.entries(value)) {
      const cleanChild = this.cleanObjectField(child);
      if (cleanChild !== undefined) {
        cleaned[key] = cleanChild;
      }
    }
    return cleaned;
  }

  private cleanObjectField(value: BlueIdInputValue): HashValue | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (this.isScalar(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.cleanRoot(item));
    }
    const cleaned: { [key: string]: HashValue } = {};
    for (const [key, child] of Object.entries(value)) {
      const cleanChild = this.cleanObjectField(child);
      if (cleanChild !== undefined) {
        cleaned[key] = cleanChild;
      }
    }
    return Object.keys(cleaned).length === 0 ? undefined : cleaned;
  }

  private isPreviousControl(value: HashValue): boolean {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1
    ) {
      return false;
    }
    const previous = value[LIST_CONTROL_PREVIOUS];
    return (
      typeof previous === 'object' &&
      previous !== null &&
      !Array.isArray(previous) &&
      Object.keys(previous).length === 1 &&
      typeof previous[OBJECT_BLUE_ID] === 'string'
    );
  }

  private previousBlueId(value: HashValue): string {
    const previous = (value as { [key: string]: { [key: string]: string } })[
      LIST_CONTROL_PREVIOUS
    ];
    return previous[OBJECT_BLUE_ID];
  }

  private applyHash(
    value: JsonBlueValue,
    isSync: boolean,
  ): SyncOrAsync<string> {
    return isSync
      ? this.hashProvider.applySync(value)
      : this.hashProvider.apply(value);
  }

  private isScalar(value: unknown): value is string | number | boolean {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }
}
