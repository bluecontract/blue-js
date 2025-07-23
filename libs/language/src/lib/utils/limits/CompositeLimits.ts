import { BlueNode } from '../../model';
import { Limits } from './Limits';

/**
 * Composite implementation of Limits that combines multiple limit strategies.
 * All limits must allow an operation for it to proceed (AND logic).
 */
export class CompositeLimits extends Limits {
  private readonly limits: Limits[];

  /**
   * Creates a composite limits with the specified limit strategies
   * @param limits - Array of Limits implementations to combine
   */
  constructor(limits: Limits[]) {
    super();
    this.limits = limits;
  }

  /**
   * Determines if a path segment should be extended
   * All limits must return true for the extension to be allowed
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns True if all limits allow extension, false otherwise
   */
  public shouldExtendPathSegment(
    pathSegment: string,
    currentNode: BlueNode
  ): boolean {
    return this.limits.every((limit) =>
      limit.shouldExtendPathSegment(pathSegment, currentNode)
    );
  }

  /**
   * Determines if a path segment should be merged
   * All limits must return true for the merge to be allowed
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns True if all limits allow merging, false otherwise
   */
  public shouldMergePathSegment(
    pathSegment: string,
    currentNode: BlueNode
  ): boolean {
    return this.limits.every((limit) =>
      limit.shouldMergePathSegment(pathSegment, currentNode)
    );
  }

  /**
   * Enters a path segment for all limits
   * @param pathSegment - The path segment
   * @param currentNode - The current node (optional)
   */
  public enterPathSegment(pathSegment: string, currentNode?: BlueNode): void {
    this.limits.forEach((limit) => {
      limit.enterPathSegment(pathSegment, currentNode);
    });
  }

  /**
   * Exits a path segment for all limits
   */
  public exitPathSegment(): void {
    this.limits.forEach((limit) => {
      limit.exitPathSegment();
    });
  }

  /**
   * Creates a composite limits from multiple limit instances
   * @param limits - The limits to combine
   * @returns A new CompositeLimits instance
   */
  public static of(...limits: Limits[]): CompositeLimits {
    return new CompositeLimits(limits);
  }
}
