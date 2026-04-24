import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { BlueError, BlueErrorCode } from '../errors/BlueError';
import { SemanticStorageService } from '../identity/SemanticStorageService';

export class InMemoryNodeProvider extends NodeProvider {
  private blueIdToNodesMap: Map<string, BlueNode[]> = new Map();
  private readonly storageService = new SemanticStorageService({
    nodeProvider: this,
  });

  constructor() {
    super();
  }

  override fetchByBlueId = (blueId: string): BlueNode[] => {
    return this.blueIdToNodesMap.get(blueId) || [];
  };

  private processSingleNode = (node: BlueNode) => {
    const prepared = this.storageService.prepareStorageNode(node, (n) => n);
    this.blueIdToNodesMap.set(prepared.blueId, [prepared.node]);
  };

  private processNodeList = (nodes: BlueNode[]) => {
    const prepared = this.storageService.prepareStorageNodeList(
      nodes,
      (n) => n,
    );
    this.blueIdToNodesMap.set(prepared.blueId, prepared.nodes);
  };

  public addSingleNodes = (...nodes: BlueNode[]) => {
    nodes.forEach(this.processSingleNode);
  };

  public addList = (nodes: BlueNode[]) => {
    this.processNodeList(nodes);
  };

  public addListAndItsItems = (nodes: BlueNode[]) => {
    this.processNodeList(nodes);
    nodes.forEach(this.processSingleNode);
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
  };
}
