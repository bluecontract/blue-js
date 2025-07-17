import { BlueNode } from '../model';
import { Limits, NO_LIMITS } from '../utils/limits';

/**
 * Abstract resolver class for resolving nodes with optional limits
 * Similar to the Java version, this provides a default implementation for resolve without limits
 */
export abstract class NodeResolver {
  /**
   * Resolves a node with the given limits
   * @param node - The node to resolve
   * @param limits - The limits to apply during resolution
   * @returns The resolved node
   */
  abstract resolve(node: BlueNode, limits: Limits): BlueNode;

  /**
   * Resolves a node without limits
   * Default implementation that uses NO_LIMITS
   *
   * @param node - The node to resolve
   * @returns The resolved node using NO_LIMITS
   */
  resolveWithoutLimits(node: BlueNode): BlueNode {
    return this.resolve(node, NO_LIMITS);
  }
}

/**
 * Helper function to create a simple NodeResolver with a custom resolve implementation
 */
export function createNodeResolver(
  resolveFn: (node: BlueNode, limits: Limits) => BlueNode
): NodeResolver {
  return new (class extends NodeResolver {
    resolve(node: BlueNode, limits: Limits): BlueNode {
      return resolveFn(node, limits);
    }
  })();
}
