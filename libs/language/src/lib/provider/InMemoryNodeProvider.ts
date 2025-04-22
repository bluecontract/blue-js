import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { BlueIdCalculator } from '../utils';

export class InMemoryNodeProvider extends NodeProvider {
  private blueIdToNodesMap: Map<string, BlueNode[]> = new Map();

  constructor() {
    super();
  }

  override fetchByBlueId = (blueId: string): BlueNode[] => {
    return this.blueIdToNodesMap.get(blueId) || [];
  };

  private processSingleNode = (node: BlueNode) => {
    const blueId = BlueIdCalculator.calculateBlueIdSync(node);
    this.blueIdToNodesMap.set(blueId, [node]);
  };

  private processNodeList = (nodes: BlueNode[]) => {
    const blueId = BlueIdCalculator.calculateBlueIdSync(nodes);
    this.blueIdToNodesMap.set(blueId, nodes);
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
}
