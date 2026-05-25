import { NodeToBlueIdInput } from '../utils/NodeToBlueIdInput';
import { FrozenNode } from './FrozenNode';

export class FrozenNodeToBlueIdInput {
  public static toBlueIdInput(node: FrozenNode): unknown {
    return NodeToBlueIdInput.get(node.toNode());
  }
}
