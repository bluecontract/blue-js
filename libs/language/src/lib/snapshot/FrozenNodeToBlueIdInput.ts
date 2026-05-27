import { NodeToBlueIdInput } from '../utils/NodeToBlueIdInput';
import { FrozenNode } from './FrozenNode';

export class FrozenNodeToBlueIdInput {
  public static toBlueIdInput(node: FrozenNode): unknown {
    return node.isListElementContext()
      ? NodeToBlueIdInput.getListElement(node.toNode(), 0)
      : NodeToBlueIdInput.get(node.toNode());
  }
}
