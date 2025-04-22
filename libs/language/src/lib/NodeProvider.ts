import { BlueNode } from './model';

/**
 * Abstract provider class for fetching nodes by Blue ID
 * Similar to the Java version, this provides a default implementation for fetchFirstByBlueId
 */
export abstract class NodeProvider {
  /**
   * Fetches all nodes associated with the given Blue ID
   * @param blueId - The Blue ID to fetch nodes for
   * @returns A list of nodes found for the Blue ID
   */
  abstract fetchByBlueId(blueId: string): BlueNode[] | null;

  /**
   * Fetches the first node associated with the given Blue ID
   * Default implementation that takes the first node from fetchByBlueId result
   *
   * @param blueId - The Blue ID to fetch nodes for
   * @returns The first node found for the Blue ID, or null if none exist
   */
  fetchFirstByBlueId(blueId: string): BlueNode | null {
    const nodes = this.fetchByBlueId(blueId);
    if (nodes && nodes.length > 0) {
      return nodes[0];
    }
    return null;
  }
}

/**
 * Helper function to create a simple NodeProvider with a custom fetchByBlueId implementation
 */
export function createNodeProvider(
  fetchByBlueIdFn: (blueId: string) => BlueNode[]
): NodeProvider {
  return new (class extends NodeProvider {
    fetchByBlueId(blueId: string): BlueNode[] {
      return fetchByBlueIdFn(blueId);
    }
  })();
}
