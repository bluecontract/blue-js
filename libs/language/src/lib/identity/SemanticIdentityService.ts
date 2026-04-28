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
import { CyclicSetIdentityService } from './CyclicSetIdentityService';

export interface SemanticIdentityServiceOptions {
  nodeProvider?: NodeProvider;
  mergingProcessor?: MergingProcessor;
}

export class SemanticIdentityService {
  private readonly nodeProvider: NodeProvider;
  private readonly mergingProcessor: MergingProcessor;
  private readonly minimizer = new Minimizer();
  private readonly cyclicSetIdentity: CyclicSetIdentityService;

  constructor(options: SemanticIdentityServiceOptions = {}) {
    this.nodeProvider = options.nodeProvider ?? createNodeProvider(() => []);
    this.mergingProcessor =
      options.mergingProcessor ?? createDefaultMergingProcessor();
    this.cyclicSetIdentity = this.createCyclicSetIdentityService();
  }

  /** @internal */
  public createCyclicSetIdentityService(): CyclicSetIdentityService {
    return new CyclicSetIdentityService({
      prepareDocument: (node) => this.prepareCyclicDocument(node),
      calculateBlueId: (value) => this.hashCyclicPrepared(value),
    });
  }

  public calculateBlueId(value: BlueNode | BlueNode[]) {
    const cyclicBlueId = this.tryCalculateCyclicSetBlueId(value);
    if (cyclicBlueId !== undefined) {
      return Promise.resolve(cyclicBlueId);
    }

    const minimal = this.toMinimalIdentityInput(value);
    return this.hashMinimalTrustedAsync(minimal);
  }

  public calculateBlueIdSync(value: BlueNode | BlueNode[]) {
    const cyclicBlueId = this.tryCalculateCyclicSetBlueId(value);
    if (cyclicBlueId !== undefined) {
      return cyclicBlueId;
    }

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
    return this.minimizeAuthoringWithProvider(node, this.nodeProvider);
  }

  private minimizeAuthoringWithProvider(
    node: BlueNode,
    nodeProvider: NodeProvider,
  ): BlueNode {
    const resolved = new Merger(this.mergingProcessor, nodeProvider).resolve(
      node,
      NO_LIMITS,
    );
    return this.minimizeResolved(resolved);
  }

  /** @internal */
  public hashMinimalTrusted(minimal: BlueNode | BlueNode[]): string {
    return this.hashMinimalTrustedWithProvider(minimal, this.nodeProvider);
  }

  private hashMinimalTrustedWithProvider(
    minimal: BlueNode | BlueNode[],
    nodeProvider: NodeProvider,
  ): string {
    if (Array.isArray(minimal)) {
      StorageShapeValidator.validateStorageListShape(minimal);
      return BlueIdCalculator.calculateBlueIdSync(
        this.toHashableMinimalTrusted(minimal, nodeProvider),
      );
    }

    StorageShapeValidator.validateStorageShape(minimal);
    return BlueIdCalculator.calculateBlueIdSync(
      this.toHashableMinimalTrusted(minimal, nodeProvider),
    );
  }

  /** @internal */
  public hashMinimalTrustedAsync(
    minimal: BlueNode | BlueNode[],
  ): Promise<string> {
    if (Array.isArray(minimal)) {
      StorageShapeValidator.validateStorageListShape(minimal);
      return BlueIdCalculator.calculateBlueId(
        this.toHashableMinimalTrusted(minimal),
      );
    }

    StorageShapeValidator.validateStorageShape(minimal);
    return BlueIdCalculator.calculateBlueId(
      this.toHashableMinimalTrusted(minimal),
    );
  }

  private toHashableMinimalTrusted(
    minimal: BlueNode | BlueNode[],
    nodeProvider = this.nodeProvider,
  ): BlueNode | BlueNode[] {
    if (Array.isArray(minimal)) {
      return minimal.map((node) =>
        this.toHashableMinimalTrustedNode(node, nodeProvider),
      );
    }

    return this.toHashableMinimalTrustedNode(minimal, nodeProvider);
  }

  private toHashableMinimalTrustedNode(
    minimal: BlueNode,
    nodeProvider = this.nodeProvider,
  ): BlueNode {
    if (!ListControls.hasPositionControl(minimal)) {
      return minimal;
    }

    const resolved = new Merger(this.mergingProcessor, nodeProvider).resolve(
      minimal,
      NO_LIMITS,
    );
    return this.minimizer.minimizeResolvedForHash(resolved);
  }

  private prepareCyclicDocument(node: BlueNode): BlueNode {
    return this.minimizeAuthoringWithProvider(
      node,
      this.createCyclicReferenceNodeProvider(),
    );
  }

  private hashCyclicPrepared(value: BlueNode | BlueNode[]): string {
    return this.hashMinimalTrustedWithProvider(
      value,
      this.createCyclicReferenceNodeProvider(),
    );
  }

  private createCyclicReferenceNodeProvider(): NodeProvider {
    const delegate = this.nodeProvider;
    return new (class extends NodeProvider {
      override fetchByBlueId(blueId: string): BlueNode[] | null {
        if (
          blueId === CyclicSetIdentityService.ZERO_BLUE_ID ||
          CyclicSetIdentityService.isIndexedThisReference(blueId)
        ) {
          return [new BlueNode().setReferenceBlueId(blueId)];
        }

        return delegate.fetchByBlueId(blueId);
      }
    })();
  }

  private toMinimalIdentityInput(value: BlueNode | BlueNode[]) {
    if (Array.isArray(value)) {
      return this.toMinimalListIdentityInput(value);
    }

    return this.minimize(value);
  }

  private tryCalculateCyclicSetBlueId(
    value: BlueNode | BlueNode[],
  ): string | undefined {
    const items = this.getTopLevelSetItems(value);
    if (items === undefined) {
      if (
        !Array.isArray(value) &&
        CyclicSetIdentityService.hasThisReference([value])
      ) {
        throw new Error(
          "Direct cyclic references using 'this#k' are supported only in a top-level document set.",
        );
      }
      return undefined;
    }

    if (!CyclicSetIdentityService.hasThisReference(items)) {
      return undefined;
    }

    return this.cyclicSetIdentity.calculate(items).blueId;
  }

  private getTopLevelSetItems(
    value: BlueNode | BlueNode[],
  ): BlueNode[] | undefined {
    if (Array.isArray(value)) {
      return value;
    }

    if (Nodes.hasItemsOnly(value)) {
      return value.getItems() ?? [];
    }

    return undefined;
  }

  private toMinimalListIdentityInput(items: BlueNode[]): BlueNode[] {
    StorageShapeValidator.validateListControlShape(items);
    const wrapper = new BlueNode().setItems(items);
    const minimalWrapper = this.minimizeAuthoring(wrapper);
    return minimalWrapper.getItems() ?? [];
  }
}

export type SemanticIdentityInput = JsonBlueValue | BlueNode | BlueNode[];
