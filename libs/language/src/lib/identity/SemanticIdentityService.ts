import { JsonBlueValue } from '../../schema';
import { BlueNode } from '../model/Node';
import { Merger } from '../merge/Merger';
import { MergingProcessor } from '../merge/MergingProcessor';
import { createDefaultMergingProcessor } from '../merge';
import { NodeProvider, createNodeProvider } from '../NodeProvider';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { NO_LIMITS } from '../utils/limits';
import { Nodes } from '../utils/Nodes';
import { Minimizer } from '../utils/Minimizer';

export interface SemanticIdentityServiceOptions {
  nodeProvider?: NodeProvider;
  mergingProcessor?: MergingProcessor;
}

export class SemanticIdentityService {
  private readonly nodeProvider: NodeProvider;
  private readonly mergingProcessor: MergingProcessor;
  private readonly minimizer = new Minimizer();

  constructor(options: SemanticIdentityServiceOptions = {}) {
    this.nodeProvider = options.nodeProvider ?? createNodeProvider(() => []);
    this.mergingProcessor =
      options.mergingProcessor ?? createDefaultMergingProcessor();
  }

  public calculateBlueId(value: BlueNode | BlueNode[]) {
    const minimal = this.toMinimalIdentityInput(value);
    return BlueIdCalculator.calculateBlueId(minimal);
  }

  public calculateBlueIdSync(value: BlueNode | BlueNode[]) {
    const minimal = this.toMinimalIdentityInput(value);
    return BlueIdCalculator.calculateBlueIdSync(minimal);
  }

  public minimize(node: BlueNode): BlueNode {
    if (Nodes.hasBlueIdOnly(node)) {
      return node.clone();
    }

    if (node.isResolved()) {
      return this.minimizer.minimize(node);
    }

    const resolved = new Merger(
      this.mergingProcessor,
      this.nodeProvider,
    ).resolve(node, NO_LIMITS);
    return this.minimizer.minimize(resolved);
  }

  private toMinimalIdentityInput(value: BlueNode | BlueNode[]) {
    if (Array.isArray(value)) {
      return value.map((node) => this.minimize(node));
    }

    return this.minimize(value);
  }
}

export type SemanticIdentityInput = JsonBlueValue | BlueNode | BlueNode[];
