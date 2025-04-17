import { BlueNode } from '../../model';

/**
 * Abstract class for specifying limits on node extension
 */
export abstract class Limits {
  /**
   * Determines if a path segment should be extended
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns True if the segment should be extended, false otherwise
   */
  public abstract shouldExtendPathSegment(
    pathSegment: string,
    currentNode: BlueNode
  ): boolean;

  /**
   * Determines if a path segment should be merged
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns True if the segment should be merged, false otherwise
   */
  public abstract shouldMergePathSegment(
    pathSegment: string,
    currentNode: BlueNode
  ): boolean;

  /**
   * Enters a path segment with an optional node
   * @param pathSegment - The path segment
   * @param currentNode - The current node (optional)
   */
  public abstract enterPathSegment(
    pathSegment: string,
    currentNode?: BlueNode
  ): void;

  /**
   * Exits a path segment
   */
  public abstract exitPathSegment(): void;
}
