import { BlueNode } from '../model/Node';
import { NodeToObject, Strategy } from './NodeToObject';
import { Base58Sha256Provider } from './Base58Sha256Provider';
import {
  OBJECT_BLUE_ID,
  OBJECT_DESCRIPTION,
  OBJECT_NAME,
  OBJECT_REF,
  OBJECT_VALUE,
} from './Properties';
import {
  isBigNumber,
  isJsonBluePrimitive,
  isReadonlyArray,
} from '../../utils/typeGuards';
import { JsonBlueArray, JsonBlueObject, JsonBlueValue } from '../../types';

type HashProvider = { apply: (object: JsonBlueValue) => Promise<string> };

export class BlueIdCalculator {
  public static INSTANCE = new BlueIdCalculator(new Base58Sha256Provider());

  private hashProvider: HashProvider;

  constructor(hashProvider: HashProvider) {
    this.hashProvider = hashProvider;
  }

  public static async calculateBlueId(node: BlueNode, strategy?: Strategy) {
    if (strategy) {
      return BlueIdCalculator.INSTANCE.calculate(
        NodeToObject.get(node, strategy)
      );
    }
    return BlueIdCalculator.INSTANCE.calculate(NodeToObject.get(node));
  }

  public static async calculateBlueIdForNodes(nodes: BlueNode[]) {
    const objects = nodes.map((node) => NodeToObject.get(node));
    return BlueIdCalculator.INSTANCE.calculate(objects);
  }

  public async calculate(object: JsonBlueValue) {
    if (isJsonBluePrimitive(object) || isBigNumber(object)) {
      return this.hashProvider.apply(
        object === null ? 'null' : object.toString()
      );
    } else if (Array.isArray(object) || isReadonlyArray(object)) {
      return this.calculateList(object);
    } else {
      return this.calculateMap(object);
    }
    throw new Error(
      `Object must be a String, Number, Boolean, List or Map - found ${typeof object}`
    );
  }

  private async calculateMap(map: JsonBlueObject) {
    if (map[OBJECT_BLUE_ID] !== undefined && map[OBJECT_BLUE_ID] !== null) {
      return map[OBJECT_BLUE_ID] as string;
    }

    const mapKeys = Object.keys(map);
    const hashes = {} as JsonBlueObject;
    for (const key of mapKeys) {
      if (
        [OBJECT_NAME, OBJECT_VALUE, OBJECT_REF, OBJECT_DESCRIPTION].includes(
          key
        )
      ) {
        hashes[key] = map[key];
      } else {
        hashes[key] = await this.calculate(map[key]);
      }
    }

    return this.hashProvider.apply(hashes);
  }

  private async calculateList(list: JsonBlueArray): Promise<string> {
    if (list.length === 0) {
      throw new Error('List must not be empty.');
    }
    if (list.length === 1) {
      return this.calculate(list[0]);
    }

    const subList = list.slice(0, -1);
    const hashOfSubList = await this.calculateList(subList);

    const lastElement = list[list.length - 1];
    const hashOfLastElement = await this.calculate(lastElement);

    return this.hashProvider.apply([hashOfSubList, hashOfLastElement]);
  }
}
