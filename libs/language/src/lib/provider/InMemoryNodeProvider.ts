import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { BlueError, BlueErrorCode } from '../errors/BlueError';
import { SemanticStorageService } from '../identity/SemanticStorageService';
import { CyclicSetIdentityService } from '../identity/CyclicSetIdentityService';

export class InMemoryNodeProvider extends NodeProvider {
  private blueIdToNodesMap: Map<string, BlueNode[]> = new Map();
  private blueIdToMultipleDocumentsMap: Map<string, boolean> = new Map();
  private readonly storageService = new SemanticStorageService({
    nodeProvider: this,
  });

  constructor() {
    super();
  }

  override fetchByBlueId = (blueId: string): BlueNode[] => {
    const directNodes = this.blueIdToNodesMap.get(blueId);
    if (directNodes !== undefined) {
      return this.resolveThisReferences(
        directNodes,
        blueId,
        this.blueIdToMultipleDocumentsMap.get(blueId) ?? false,
      );
    }

    const indexed = this.parseIndexedBlueId(blueId);
    if (indexed === undefined) {
      return [];
    }

    const baseNodes = this.blueIdToNodesMap.get(indexed.baseBlueId);
    if (
      baseNodes === undefined ||
      !(this.blueIdToMultipleDocumentsMap.get(indexed.baseBlueId) ?? false) ||
      indexed.index >= baseNodes.length
    ) {
      return [];
    }

    return [
      this.resolveThisReferencesInNode(
        baseNodes[indexed.index],
        indexed.baseBlueId,
        true,
      ),
    ];
  };

  private processSingleNode = (node: BlueNode) => {
    const prepared = this.storageService.prepareStorageNode(node, (n) => n);
    this.blueIdToNodesMap.set(prepared.blueId, [prepared.node]);
    this.blueIdToMultipleDocumentsMap.set(prepared.blueId, false);
  };

  private processNodeList = (nodes: BlueNode[]) => {
    const prepared = this.storageService.prepareStorageNodeList(
      nodes,
      (n) => n,
    );
    this.blueIdToNodesMap.set(prepared.blueId, prepared.nodes);
    this.blueIdToMultipleDocumentsMap.set(prepared.blueId, true);
  };

  public addSingleNodes = (...nodes: BlueNode[]) => {
    nodes.forEach(this.processSingleNode);
  };

  public addList = (nodes: BlueNode[]) => {
    this.processNodeList(nodes);
  };

  public addListAndItsItems = (nodes: BlueNode[]) => {
    this.processNodeList(nodes);
    if (!CyclicSetIdentityService.hasThisReference(nodes)) {
      nodes.forEach(this.processSingleNode);
    }
  };

  /**
   * Adds a node with a specific blueId without calculating it
   * @param blueId - The blueId to use as the key
   * @param node - The node to add
   */
  public addNodeWithBlueId = (blueId: string, node: BlueNode) => {
    const prepared = this.storageService.prepareStorageNode(node, (n) => n);
    const computedBlueId = prepared.blueId;
    if (computedBlueId !== blueId) {
      throw new BlueError(
        BlueErrorCode.BLUE_ID_MISMATCH,
        `Provided BlueId '${blueId}' does not match computed BlueId '${computedBlueId}'.`,
      );
    }
    this.blueIdToNodesMap.set(blueId, [prepared.node]);
    this.blueIdToMultipleDocumentsMap.set(blueId, false);
  };

  private parseIndexedBlueId(
    blueId: string,
  ): { baseBlueId: string; index: number } | undefined {
    const separatorIndex = blueId.indexOf('#');
    if (separatorIndex === -1) {
      return undefined;
    }

    const baseBlueId = blueId.slice(0, separatorIndex);
    const index = Number(blueId.slice(separatorIndex + 1));
    if (!Number.isInteger(index) || index < 0) {
      return undefined;
    }

    return { baseBlueId, index };
  }

  private resolveThisReferences(
    nodes: BlueNode[],
    currentBlueId: string,
    isMultipleDocuments: boolean,
  ): BlueNode[] {
    return nodes.map((node) =>
      this.resolveThisReferencesInNode(
        node,
        currentBlueId,
        isMultipleDocuments,
      ),
    );
  }

  private resolveThisReferencesInNode(
    node: BlueNode,
    currentBlueId: string,
    isMultipleDocuments: boolean,
  ): BlueNode {
    const cloned = node.clone();
    this.resolveThisReferencesInPlace(
      cloned,
      currentBlueId,
      isMultipleDocuments,
    );
    return cloned;
  }

  private resolveThisReferencesInPlace(
    node: BlueNode,
    currentBlueId: string,
    isMultipleDocuments: boolean,
  ): void {
    const referenceBlueId = node.getReferenceBlueId();
    if (referenceBlueId !== undefined) {
      if (isMultipleDocuments && referenceBlueId.startsWith('this#')) {
        node.setReferenceBlueId(`${currentBlueId}${referenceBlueId.slice(4)}`);
      } else if (!isMultipleDocuments && referenceBlueId === 'this') {
        node.setReferenceBlueId(currentBlueId);
      }
    }

    [
      node.getType(),
      node.getItemType(),
      node.getKeyType(),
      node.getValueType(),
      node.getBlue(),
      ...(node.getItems() ?? []),
      ...Object.values(node.getProperties() ?? {}),
    ].forEach((child) => {
      if (child !== undefined) {
        this.resolveThisReferencesInPlace(
          child,
          currentBlueId,
          isMultipleDocuments,
        );
      }
    });
  }
}
