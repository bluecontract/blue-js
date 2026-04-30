import { JsonBlueValue } from '../../schema';
import { BlueIdHasher } from '../identity/BlueIdHasher';
import { BlueNode } from '../model/Node';
import { Base58Sha256Provider } from './Base58Sha256Provider';

type HashProvider = {
  apply: (object: JsonBlueValue) => Promise<string>;
  applySync: (object: JsonBlueValue) => string;
};

export class BlueIdCalculator {
  public static INSTANCE = new BlueIdCalculator(new Base58Sha256Provider());

  private readonly hasher: BlueIdHasher;

  constructor(hashProvider: HashProvider) {
    this.hasher = new BlueIdHasher(hashProvider);
  }

  public static calculateBlueId(node: BlueNode | BlueNode[]) {
    return BlueIdCalculator.INSTANCE.calculate(node);
  }

  public static calculateBlueIdSync(node: BlueNode | BlueNode[]) {
    return BlueIdCalculator.INSTANCE.calculateSync(node);
  }

  public calculate(object: JsonBlueValue | BlueNode | BlueNode[]) {
    return this.hasher.calculate(object);
  }

  public calculateSync(object: JsonBlueValue | BlueNode | BlueNode[]) {
    return this.hasher.calculateSync(object);
  }
}
