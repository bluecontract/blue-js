import { BlueNode } from './Node';

export class ResolvedBlueNode extends BlueNode {
  private readonly _originalNode: BlueNode;

  constructor(resolvedNode: BlueNode, originalNode: BlueNode) {
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

    this._originalNode = originalNode;
  }

  public override isResolved(): boolean {
    return true;
  }

  public getOriginalNode(): BlueNode {
    return this._originalNode;
  }

  public override clone(): ResolvedBlueNode {
    return new ResolvedBlueNode(super.clone(), this._originalNode);
  }
}
