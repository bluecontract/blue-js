import { MergeReverser } from '../utils/MergeReverser';
import { BlueNode } from './Node';

export class ResolvedBlueNode extends BlueNode {
  constructor(resolvedNode: BlueNode) {
    super(resolvedNode.getName());

    this.setDescription(resolvedNode.getDescription())
      .setType(resolvedNode.getType())
      .setItemType(resolvedNode.getItemType())
      .setKeyType(resolvedNode.getKeyType())
      .setValueType(resolvedNode.getValueType())
      .setItems(resolvedNode.getItems())
      .setProperties(resolvedNode.getProperties())
      .setBlueId(resolvedNode.getBlueId())
      .setBlue(resolvedNode.getBlue())
      .setInlineValue(resolvedNode.isInlineValue());

    const value = resolvedNode.getValue();
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.setValue(value as any);
    }
  }

  public override isResolved(): boolean {
    return true;
  }

  public getOriginalNode(): BlueNode {
    return new MergeReverser().reverse(this);
  }

  public override clone(): ResolvedBlueNode {
    return new ResolvedBlueNode(super.clone());
  }
}
