import { MergingProcessor, createDefaultMergingProcessor } from '../merge';
import { BlueNode } from '../model';
import { NodeProvider, createNodeProvider } from '../NodeProvider';
import { StorageShapeValidator } from '../utils/StorageShapeValidator';
import { CyclicSetIdentityService } from './CyclicSetIdentityService';
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
  documentBlueIds?: string[];
  isCyclicSet?: boolean;
}

export class SemanticStorageService {
  private readonly semanticIdentity: SemanticIdentityService;
  private readonly cyclicSetIdentity = new CyclicSetIdentityService();

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
    if (this.hasThisReference(preprocessedNode)) {
      throw new Error(
        'Self-references using this or this#k are not supported in provider storage ingest until phase 3.',
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

    if (CyclicSetIdentityService.hasThisReference(preprocessedNodes)) {
      const cyclicSet = this.cyclicSetIdentity.calculate(preprocessedNodes);
      cyclicSet.nodes.forEach((node) =>
        StorageShapeValidator.validateStorageShape(node),
      );
      return {
        blueId: cyclicSet.blueId,
        nodes: cyclicSet.nodes,
        documentBlueIds: cyclicSet.documentBlueIds,
        isCyclicSet: true,
      };
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
    const prepared = this.prepareSemanticStorage(preprocessedNode);

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

  private hasThisReference(node: BlueNode): boolean {
    const referenceBlueId = node.getReferenceBlueId();
    if (
      referenceBlueId !== undefined &&
      (referenceBlueId === 'this' || referenceBlueId.startsWith('this#'))
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
}
