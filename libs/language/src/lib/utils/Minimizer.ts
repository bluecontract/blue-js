import { BlueNode } from '../model/Node';
import { MergeReverser } from './MergeReverser';

export class Minimizer {
  private readonly mergeReverser = new MergeReverser();
  private readonly hashMergeReverser = new MergeReverser({
    emitListControls: false,
  });

  /**
   * Backwards-compatible entry point. New code should call the explicit
   * authoring/resolved/storage methods so it does not mix input contracts.
   */
  public minimize<T extends BlueNode>(node: T): BlueNode {
    return this.minimizeResolved(node);
  }

  public minimizeResolved<T extends BlueNode>(node: T): BlueNode {
    return this.mergeReverser.reverse(node);
  }

  public minimizeResolvedForHash<T extends BlueNode>(node: T): BlueNode {
    return this.hashMergeReverser.reverse(node);
  }
}
