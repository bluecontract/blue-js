import { JsonBlueValue } from '../../schema';
import { BlueNode } from '../model/Node';
import { Base58Sha256Provider } from '../utils/Base58Sha256Provider';
import {
  BlueIdInputValue,
  NodeToBlueIdInput,
} from '../utils/NodeToBlueIdInput';
import {
  LIST_CONTROL_PREVIOUS,
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_NAME,
  OBJECT_VALUE,
} from '../utils/Properties';

type HashValue =
  | string
  | number
  | boolean
  | HashValue[]
  | { [key: string]: HashValue };

const INLINE_KEYS = new Set([OBJECT_NAME, OBJECT_DESCRIPTION, OBJECT_VALUE]);

export class JavaBlueIdCalculator {
  private static readonly hashProvider = new Base58Sha256Provider();

  public static calculateBlueIdSync(node: BlueNode): string {
    return this.calculateInputSync(NodeToBlueIdInput.get(node));
  }

  public static calculateBlueIdAllowingCyclicPlaceholdersSync(
    node: BlueNode,
  ): string {
    return this.calculateInputSync(
      NodeToBlueIdInput.getAllowingCyclicPlaceholders(node),
    );
  }

  public static calculateListBlueIdSync(nodes: BlueNode[]): string {
    return this.calculateInputSync(
      nodes.map((node, index) => NodeToBlueIdInput.getListElement(node, index)),
    );
  }

  public static calculateListBlueIdAllowingCyclicPlaceholdersSync(
    nodes: BlueNode[],
  ): string {
    return this.calculateInputSync(
      nodes.map((node, index) =>
        NodeToBlueIdInput.getListElementAllowingCyclicPlaceholders(node, index),
      ),
    );
  }

  public static calculateInputSync(input: BlueIdInputValue): string {
    return this.calculateCleaned(this.cleanRoot(input));
  }

  private static calculateCleaned(value: HashValue): string {
    if (this.isScalar(value)) {
      return this.hashProvider.applySync(value);
    }
    if (Array.isArray(value)) {
      return this.calculateList(value);
    }
    return this.calculateMap(value);
  }

  private static calculateMap(map: { [key: string]: HashValue }): string {
    if (
      Object.keys(map).length === 1 &&
      typeof map[OBJECT_BLUE_ID] === 'string'
    ) {
      return map[OBJECT_BLUE_ID] as string;
    }

    const hashed: { [key: string]: JsonBlueValue } = {};
    for (const key of Object.keys(map).sort()) {
      const value = map[key];
      if (INLINE_KEYS.has(key)) {
        hashed[key] = value as JsonBlueValue;
      } else {
        hashed[key] = {
          [OBJECT_BLUE_ID]: this.calculateCleaned(value),
        };
      }
    }
    return this.hashProvider.applySync(hashed);
  }

  private static calculateList(list: HashValue[]): string {
    let accumulator = this.hashProvider.applySync({ $list: 'empty' });
    let start = 0;
    if (list.length > 0 && this.isPreviousControl(list[0])) {
      accumulator = this.previousBlueId(list[0]);
      start = 1;
    }
    for (let i = start; i < list.length; i++) {
      const elementHash = this.calculateCleaned(list[i]);
      accumulator = this.hashProvider.applySync({
        $listCons: {
          elem: { [OBJECT_BLUE_ID]: elementHash },
          prev: { [OBJECT_BLUE_ID]: accumulator },
        },
      });
    }
    return accumulator;
  }

  private static cleanRoot(value: BlueIdInputValue): HashValue {
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

  private static cleanObjectField(
    value: BlueIdInputValue,
  ): HashValue | undefined {
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

  private static isPreviousControl(value: HashValue): boolean {
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

  private static previousBlueId(value: HashValue): string {
    const previous = (value as { [key: string]: { [key: string]: string } })[
      LIST_CONTROL_PREVIOUS
    ];
    return previous[OBJECT_BLUE_ID];
  }

  private static isScalar(
    value: BlueIdInputValue | HashValue,
  ): value is string | number | boolean {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    );
  }
}
