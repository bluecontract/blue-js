import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { BlueError, BlueErrorCode } from '../errors/BlueError';
import { BlueIdCalculator, Minimizer, StorageShapeValidator } from '../utils';

export class InMemoryNodeProvider extends NodeProvider {
  private blueIdToNodesMap: Map<string, BlueNode[]> = new Map();
  private readonly minimizer = new Minimizer();

  constructor() {
    super();
  }

  override fetchByBlueId = (blueId: string): BlueNode[] => {
    return this.blueIdToNodesMap.get(blueId) || [];
  };

  private processSingleNode = (node: BlueNode) => {
    const minimalNode = this.prepareStorageNode(node);
    const blueId = BlueIdCalculator.calculateBlueIdSync(minimalNode);
    this.blueIdToNodesMap.set(blueId, [minimalNode]);
  };

  private processNodeList = (nodes: BlueNode[]) => {
    const minimalNodes = nodes.map((node) => this.prepareStorageNode(node));
    const blueId = BlueIdCalculator.calculateBlueIdSync(minimalNodes);
    this.blueIdToNodesMap.set(blueId, minimalNodes);
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
    const minimalNode = this.prepareStorageNode(node);
    const computedBlueId = BlueIdCalculator.calculateBlueIdSync(minimalNode);
    if (computedBlueId !== blueId) {
      throw new BlueError(
        BlueErrorCode.BLUE_ID_MISMATCH,
        `Provided BlueId '${blueId}' does not match computed BlueId '${computedBlueId}'.`,
      );
    }
    this.blueIdToNodesMap.set(blueId, [minimalNode]);
  };

  private prepareStorageNode(node: BlueNode): BlueNode {
    StorageShapeValidator.validateNoMixedReferencePayload(node);
    return this.minimizer.minimize(node);
  }
}
