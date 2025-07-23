import { BlueNode, Nodes, Limits } from '@blue-labs/language';
import { isExpression } from '../expressionUtils';

/**
 * Implementation of Limits that prevents merging/extending nodes containing expressions.
 * Expressions are strings that start with "${" and end with "}".
 */
export class ExpressionLimits extends Limits {
  /**
   * Checks if a node value contains an expression
   * @param node - The node to check
   * @returns True if the node contains an expression, false otherwise
   */
  private containsExpression(node?: BlueNode): boolean {
    if (!node) {
      return false;
    }

    if (Nodes.isValidValueNode(node) && isExpression(node.getValue())) {
      return true;
    }

    return false;
  }

  /**
   * Determines if a path segment should be extended
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns False if the node contains an expression, true otherwise
   */
  public shouldExtendPathSegment(
    pathSegment: string,
    currentNode?: BlueNode
  ): boolean {
    return !this.containsExpression(currentNode);
  }

  /**
   * Determines if a path segment should be merged
   * @param pathSegment - The path segment
   * @param currentNode - The current node
   * @returns False if the node contains an expression, true otherwise
   */
  public shouldMergePathSegment(
    pathSegment: string,
    currentNode?: BlueNode
  ): boolean {
    return !this.containsExpression(currentNode);
  }

  /**
   * Enters a path segment - no-op for expression limits
   */
  public enterPathSegment(): void {
    // No-op
  }

  /**
   * Exits a path segment - no-op for expression limits
   */
  public exitPathSegment(): void {
    // No-op
  }
}
