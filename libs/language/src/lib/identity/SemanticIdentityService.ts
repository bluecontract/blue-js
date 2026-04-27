import { JsonBlueValue } from '../../schema';
import { BlueNode } from '../model/Node';
import { ResolvedBlueNode } from '../model/ResolvedNode';
import { Merger } from '../merge/Merger';
import { MergingProcessor } from '../merge/MergingProcessor';
import { createDefaultMergingProcessor } from '../merge';
import { NodeProvider, createNodeProvider } from '../NodeProvider';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { NO_LIMITS } from '../utils/limits';
import { Nodes } from '../utils/Nodes';
import { Minimizer } from '../utils/Minimizer';
import { StorageShapeValidator } from '../utils/StorageShapeValidator';
import { ListControls } from '../utils/ListControls';

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
    const hashable = this.toHashableMinimalTrusted(minimal);
    return BlueIdCalculator.calculateBlueId(hashable);
  }

  public calculateBlueIdSync(value: BlueNode | BlueNode[]) {
    const minimal = this.toMinimalIdentityInput(value);
    return this.hashMinimalTrusted(minimal);
  }

  public minimize(node: BlueNode): BlueNode {
    if (
      node instanceof ResolvedBlueNode &&
      node.getCompleteness() === 'path-limited'
    ) {
      const sourceSemanticBlueId = node.getSourceSemanticBlueId();
      if (sourceSemanticBlueId !== undefined) {
        return new BlueNode().setReferenceBlueId(sourceSemanticBlueId);
      }
      throw new Error(
        'Cannot minimize a path-limited resolved node without a source semantic BlueId.',
      );
    }

    if (Nodes.hasBlueIdOnly(node)) {
      return node.clone();
    }

    if (ListControls.hasAnyListControl(node)) {
      StorageShapeValidator.validateStorageShape(node);
      return node.clone();
    }

    if (node.isResolved()) {
      return this.minimizeResolved(node);
    }

    return this.minimizeAuthoring(node);
  }

  public minimizeResolved(node: BlueNode): BlueNode {
    if (
      node instanceof ResolvedBlueNode &&
      node.getCompleteness() === 'path-limited'
    ) {
      throw new Error(
        'Cannot minimize a path-limited resolved node as a full resolved tree.',
      );
    }

    return this.minimizer.minimizeResolved(node);
  }

  public minimizeAuthoring(node: BlueNode): BlueNode {
    const resolved = new Merger(
      this.mergingProcessor,
      this.nodeProvider,
    ).resolve(node, NO_LIMITS);
    return this.minimizeResolved(resolved);
  }

  public hashMinimalTrusted(minimal: BlueNode | BlueNode[]): string {
    if (Array.isArray(minimal)) {
      minimal.forEach((node) =>
        StorageShapeValidator.validateStorageShape(node),
      );
      return BlueIdCalculator.calculateBlueIdSync(
        this.toHashableMinimalTrusted(minimal),
      );
    }

    StorageShapeValidator.validateStorageShape(minimal);
    return BlueIdCalculator.calculateBlueIdSync(
      this.toHashableMinimalTrusted(minimal),
    );
  }

  private toHashableMinimalTrusted(
    minimal: BlueNode | BlueNode[],
  ): BlueNode | BlueNode[] {
    if (Array.isArray(minimal)) {
      return minimal.map((node) => this.toHashableMinimalTrustedNode(node));
    }

    return this.toHashableMinimalTrustedNode(minimal);
  }

  private toHashableMinimalTrustedNode(minimal: BlueNode): BlueNode {
    if (!ListControls.hasPositionControl(minimal)) {
      return minimal;
    }

    const resolved = new Merger(
      this.mergingProcessor,
      this.nodeProvider,
    ).resolve(minimal, NO_LIMITS);
    return this.minimizer.minimizeResolvedForHash(resolved);
  }

  private toMinimalIdentityInput(value: BlueNode | BlueNode[]) {
    if (Array.isArray(value)) {
      return value.map((node) => this.minimize(node));
    }

    return this.minimize(value);
  }
}

export type SemanticIdentityInput = JsonBlueValue | BlueNode | BlueNode[];
