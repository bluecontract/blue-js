import { BlueNode } from '../../../model';
import { Limits } from '../Limits';

/**
 * Simple test implementation of Limits that blocks nodes with specific values.
 * Used for testing purposes only.
 */
export class TestLimits extends Limits {
  private blockedValues: Set<string>;

  constructor(blockedValues: string[] = []) {
    super();
    this.blockedValues = new Set(blockedValues);
  }

  /**
   * Checks if a node value is blocked
   * @param node - The node to check
   * @returns True if the node value is blocked, false otherwise
   */
  private isValueBlocked(node: BlueNode): boolean {
    const value = node.getValue();
    if (typeof value === 'string') {
      return this.blockedValues.has(value);
    }
    return false;
  }

  /**
   * Determines if a path segment should be extended
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns False if the node value is blocked, true otherwise
   */
  public shouldExtendPathSegment(
    pathSegment: string,
    currentNode: BlueNode
  ): boolean {
    return !this.isValueBlocked(currentNode);
  }

  /**
   * Determines if a path segment should be merged
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns False if the node value is blocked, true otherwise
   */
  public shouldMergePathSegment(
    pathSegment: string,
    currentNode: BlueNode
  ): boolean {
    return !this.isValueBlocked(currentNode);
  }

  /**
   * Enters a path segment - no-op for test limits
   */
  public enterPathSegment(): void {
    // No-op
  }

  /**
   * Exits a path segment - no-op for test limits
   */
  public exitPathSegment(): void {
    // No-op
  }
}
