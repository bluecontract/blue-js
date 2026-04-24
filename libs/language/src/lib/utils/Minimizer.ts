import { BlueNode } from '../model/Node';
import { Nodes } from './Nodes';
import { MergeReverser } from './MergeReverser';

export class Minimizer {
  private readonly mergeReverser = new MergeReverser();

  public minimize<T extends BlueNode>(node: T): BlueNode {
    if (this.isMaterializedReference(node)) {
      // Expansion keeps the original reference BlueId on the node while
      // materializing provider content next to it. For identity/storage, that
      // runtime shape collapses back to the exact reference form.
      return new BlueNode().setReferenceBlueId(node.getReferenceBlueId());
    }

    return this.mergeReverser.reverse(node);
  }

  private isMaterializedReference(node: BlueNode): boolean {
    return (
      node.getReferenceBlueId() !== undefined && !Nodes.hasBlueIdOnly(node)
    );
  }
}
