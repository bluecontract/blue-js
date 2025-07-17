import { BlueNode } from '../model';
import { AbstractNodeProvider } from './AbstractNodeProvider';

export abstract class PreloadedNodeProvider extends AbstractNodeProvider {
  protected nameToBlueIdsMap: Map<string, string[]> = new Map();

  /**
   * Find a node by name. Throws an error if multiple nodes are found with the same name.
   * @param name - The name to search for
   * @returns The node if found, or undefined if not found
   */
  public findNodeByName(name: string): BlueNode | undefined {
    const blueIds = this.nameToBlueIdsMap.get(name);
    if (!blueIds) {
      return undefined;
    }
    if (blueIds.length > 1) {
      throw new Error(`Multiple nodes found with name: ${name}`);
    }
    const nodes = this.fetchByBlueId(blueIds[0]);
    return nodes && nodes.length > 0 ? nodes[0] : undefined;
  }

  /**
   * Find all nodes with the given name
   * @param name - The name to search for
   * @returns Array of nodes with the given name
   */
  public findAllNodesByName(name: string): BlueNode[] {
    const blueIds = this.nameToBlueIdsMap.get(name);
    if (!blueIds) {
      return [];
    }
    const result: BlueNode[] = [];
    for (const blueId of blueIds) {
      const nodes = this.fetchByBlueId(blueId);
      if (nodes) {
        result.push(...nodes);
      }
    }
    return result;
  }

  /**
   * Add a name to Blue ID mapping
   * @param name - The name of the node
   * @param blueId - The Blue ID of the node
   */
  protected addToNameMap(name: string, blueId: string): void {
    if (!this.nameToBlueIdsMap.has(name)) {
      this.nameToBlueIdsMap.set(name, []);
    }
    this.nameToBlueIdsMap.get(name)!.push(blueId);
  }
}
