import { BlueNode } from '../model/Node';
import { FrozenNode } from './FrozenNode';

export class CanonicalOverlayPatchEngine {
  public apply(
    base: FrozenNode | BlueNode,
    overlay: FrozenNode | BlueNode,
  ): FrozenNode {
    const baseNode = base instanceof FrozenNode ? base.toNode() : base.clone();
    const overlayNode =
      overlay instanceof FrozenNode ? overlay.toNode() : overlay.clone();
    const properties = overlayNode.getProperties();
    if (properties !== undefined) {
      for (const [key, value] of Object.entries(properties)) {
        baseNode.addProperty(key, value.clone());
      }
    }
    if (overlayNode.getItems() !== undefined) {
      baseNode.setItems(overlayNode.getItems()?.map((item) => item.clone()));
    }
    const overlayValue = overlayNode.getValue();
    if (overlayValue !== undefined) {
      baseNode.setValue(overlayValue);
    }
    return FrozenNode.fromUncheckedCanonicalNode(baseNode);
  }
}
