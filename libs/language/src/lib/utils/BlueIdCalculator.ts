import { BlueNode } from '../model/Node';
import { NodeToMapListOrValue } from './NodeToMapListOrValue';
import { Base58Sha256Provider } from './Base58Sha256Provider';
import { JsonBlueValue } from '../../schema';
import { SemanticBlueIdHasher } from './blueId';

type HashProvider = {
  apply: (object: JsonBlueValue) => Promise<string>;
  applySync: (object: JsonBlueValue) => string;
};

export class BlueIdCalculator {
  public static INSTANCE = new BlueIdCalculator(
    new Base58Sha256Provider(),
    SemanticBlueIdHasher.INSTANCE,
  );

  private readonly semanticHasher: SemanticBlueIdHasher;

  constructor(
    hashProvider: HashProvider,
    semanticHasher?: SemanticBlueIdHasher,
  ) {
    this.semanticHasher =
      semanticHasher ?? new SemanticBlueIdHasher(hashProvider);
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

  public calculate(object: JsonBlueValue) {
    return this.semanticHasher.calculate(object);
  }

  public calculateSync(object: JsonBlueValue) {
    return this.semanticHasher.calculateSync(object);
  }
}
