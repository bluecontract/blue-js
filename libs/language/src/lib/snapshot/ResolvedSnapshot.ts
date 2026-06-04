import { BlueNode } from '../model/Node';
import { FrozenNode } from './FrozenNode';

export class ResolvedSnapshot {
  public readonly root: FrozenNode;

  constructor(root: FrozenNode | BlueNode) {
    this.root =
      root instanceof FrozenNode ? root : FrozenNode.fromResolvedNode(root);
  }

  public toNode(): BlueNode {
    return this.root.toNode();
  }
}
