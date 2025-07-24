import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';

/**
 * Interface for processing merge operations between nodes
 */
export interface MergingProcessor {
  /**
   * Processes the merge operation between target and source nodes
   * @param target - The target node to merge into
   * @param source - The source node to merge from
   * @param nodeProvider - The node provider for resolving references
   * @returns A new BlueNode with the merged content
   */
  process(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider
  ): BlueNode;

  /**
   * Post-processes the merge operation between target and source nodes
   * Default implementation does nothing
   * @param target - The target node that was merged into
   * @param source - The source node that was merged from
   * @param nodeProvider - The node provider for resolving references
   * @returns A new BlueNode with the post-processed content
   */
  postProcess?(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider
  ): BlueNode;
}
