import { MergingProcessor, createDefaultMergingProcessor } from '../merge';
import { BlueNode } from '../model';
import { NodeProvider, createNodeProvider } from '../NodeProvider';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { Minimizer } from '../utils/Minimizer';
import { Nodes } from '../utils/Nodes';
import { StorageShapeValidator } from '../utils/StorageShapeValidator';
import { SemanticIdentityService } from './SemanticIdentityService';

export interface SemanticStorageServiceOptions {
  nodeProvider?: NodeProvider;
  mergingProcessor?: MergingProcessor;
}

export interface PreparedStorageNode {
  blueId: string;
  node: BlueNode;
}

export interface PreparedStorageNodeList {
  blueId: string;
  nodes: BlueNode[];
}

export class SemanticStorageService {
  private static readonly THIS_REFERENCE_PATTERN = /^this(#\d+)?$/;

  private readonly semanticIdentity: SemanticIdentityService;
  private readonly storageOverlayMinimizer = new Minimizer();

  constructor(options: SemanticStorageServiceOptions = {}) {
    const nodeProvider = options.nodeProvider ?? createNodeProvider(() => []);
    const mergingProcessor =
      options.mergingProcessor ?? createDefaultMergingProcessor();
    this.semanticIdentity = new SemanticIdentityService({
      nodeProvider,
      mergingProcessor,
    });
  }

  public prepareStorageNode(
    node: BlueNode,
    preprocessor: (node: BlueNode) => BlueNode,
  ): PreparedStorageNode {
    const preprocessedNode = this.preprocessForStorage(node, preprocessor);
    if (this.hasIndexedThisReference(preprocessedNode)) {
      throw new Error(
        "For a single document, only 'this' is allowed as a reference, not 'this#<id>'.",
      );
    }
    return this.preparePreprocessedStorageNode(preprocessedNode);
  }

  public prepareStorageNodeList(
    nodes: BlueNode[],
    preprocessor: (node: BlueNode) => BlueNode,
  ): PreparedStorageNodeList {
    if (nodes.length === 0) {
      throw new Error('List of nodes cannot be null or empty');
    }

    const preprocessedNodes = nodes.map((node) =>
      this.preprocessForStorage(node, preprocessor),
    );

    if (preprocessedNodes.some((node) => this.hasThisReference(node))) {
      throw new Error(
        'Direct cyclic multi-document sets using this#k are not supported until phase 3.',
      );
    }

    const minimalNodes = preprocessedNodes.map(
      (node) => this.preparePreprocessedStorageNode(node).node,
    );
    const blueId = this.semanticIdentity.hashMinimalTrusted(minimalNodes);
    return { blueId, nodes: minimalNodes };
  }

  private preprocessForStorage(
    node: BlueNode,
    preprocessor: (node: BlueNode) => BlueNode,
  ): BlueNode {
    StorageShapeValidator.validateStorageShape(node);
    const preprocessedNode = preprocessor(node);
    StorageShapeValidator.validateStorageShape(preprocessedNode);
    return preprocessedNode;
  }

  private preparePreprocessedStorageNode(
    preprocessedNode: BlueNode,
  ): PreparedStorageNode {
    const useTransitionalStoragePath =
      this.hasThisReference(preprocessedNode) ||
      this.hasLegacyInheritedListMarker(preprocessedNode);

    const prepared = useTransitionalStoragePath
      ? this.prepareStorageOverlay(preprocessedNode)
      : this.prepareSemanticStorage(preprocessedNode);

    StorageShapeValidator.validateStorageShape(prepared.node);

    return prepared;
  }

  private prepareSemanticStorage(
    preprocessedNode: BlueNode,
  ): PreparedStorageNode {
    const minimalNode =
      this.semanticIdentity.minimizeAuthoring(preprocessedNode);
    return {
      blueId: this.semanticIdentity.hashMinimalTrusted(minimalNode),
      node: minimalNode,
    };
  }

  private prepareStorageOverlay(
    preprocessedNode: BlueNode,
  ): PreparedStorageNode {
    const minimalNode =
      this.storageOverlayMinimizer.minimizeStorageOverlay(preprocessedNode);
    const blueId = BlueIdCalculator.calculateBlueIdSync(minimalNode);

    return { blueId, node: minimalNode };
  }

  private hasLegacyInheritedListMarker(node: BlueNode): boolean {
    const items = node.getItems();
    if (
      items !== undefined &&
      items.length > 1 &&
      Nodes.hasBlueIdOnly(items[0])
    ) {
      return true;
    }

    const children = [
      node.getType(),
      node.getItemType(),
      node.getKeyType(),
      node.getValueType(),
      node.getBlue(),
      ...(items ?? []),
      ...Object.values(node.getProperties() ?? {}),
    ];

    return children.some(
      (child): child is BlueNode =>
        child !== undefined && this.hasLegacyInheritedListMarker(child),
    );
  }

  private hasThisReference(node: BlueNode): boolean {
    const referenceBlueId = node.getReferenceBlueId();
    if (
      referenceBlueId !== undefined &&
      SemanticStorageService.THIS_REFERENCE_PATTERN.test(referenceBlueId)
    ) {
      return true;
    }

    const children = [
      node.getType(),
      node.getItemType(),
      node.getKeyType(),
      node.getValueType(),
      node.getBlue(),
      ...(node.getItems() ?? []),
      ...Object.values(node.getProperties() ?? {}),
    ];

    return children.some(
      (child): child is BlueNode =>
        child !== undefined && this.hasThisReference(child),
    );
  }

  private hasIndexedThisReference(node: BlueNode): boolean {
    const referenceBlueId = node.getReferenceBlueId();
    if (referenceBlueId !== undefined && /^this#\d+$/.test(referenceBlueId)) {
      return true;
    }

    const children = [
      node.getType(),
      node.getItemType(),
      node.getKeyType(),
      node.getValueType(),
      node.getBlue(),
      ...(node.getItems() ?? []),
      ...Object.values(node.getProperties() ?? {}),
    ];

    return children.some(
      (child): child is BlueNode =>
        child !== undefined && this.hasIndexedThisReference(child),
    );
  }
}
