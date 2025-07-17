import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { NodeResolver } from './NodeResolver';

/**
 * Interface for processing merge operations between nodes
 */
export interface MergingProcessor {
  /**
   * Processes the merge operation between target and source nodes
   * @param target - The target node to merge into
   * @param source - The source node to merge from
   * @param nodeProvider - The node provider for resolving references
   * @param nodeResolver - The node resolver for resolving nodes
   */
  process(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
    nodeResolver: NodeResolver
  ): void;

  /**
   * Post-processes the merge operation between target and source nodes
   * Default implementation does nothing
   * @param target - The target node that was merged into
   * @param source - The source node that was merged from
   * @param nodeProvider - The node provider for resolving references
   * @param nodeResolver - The node resolver for resolving nodes
   */
  postProcess?(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
    nodeResolver: NodeResolver
  ): void;
}

/**
 * Helper function to create a simple MergingProcessor with custom implementations
 */
export function createMergingProcessor(
  processFn: (
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
    nodeResolver: NodeResolver
  ) => void,
  postProcessFn?: (
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
    nodeResolver: NodeResolver
  ) => void
): MergingProcessor {
  return {
    process: processFn,
    postProcess: postProcessFn,
  };
}
