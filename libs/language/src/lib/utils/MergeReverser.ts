import { BlueNode } from '../model';
import { Nodes } from './Nodes';
import { BlueIdCalculator } from './BlueIdCalculator';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';

export class MergeReverser {
  public reverse(mergedNode: BlueNode): BlueNode {
    const minimalNode = new BlueNode();
    this.reverseNode(minimalNode, mergedNode, mergedNode.getType());
    return minimalNode;
  }

  private reverseNode(
    minimal: BlueNode,
    merged: BlueNode,
    fromType: BlueNode | undefined
  ): void {
    if (
      isNonNullable(merged.getBlueId()) &&
      isNonNullable(fromType) &&
      merged.getBlueId() === fromType.getBlueId()
    ) {
      return;
    }

    const mergedValue = merged.getValue();
    if (
      isNonNullable(mergedValue) &&
      (isNullable(fromType) || isNullable(fromType?.getValue()))
    ) {
      minimal.setValue(mergedValue);
    }

    this.setTypeIfDifferent(
      merged,
      fromType,
      minimal,
      (n) => n.getType(),
      (n, t) => n.setType(t)
    );
    this.setTypeIfDifferent(
      merged,
      fromType,
      minimal,
      (n) => n.getItemType(),
      (n, t) => n.setItemType(t)
    );
    this.setTypeIfDifferent(
      merged,
      fromType,
      minimal,
      (n) => n.getKeyType(),
      (n, t) => n.setKeyType(t)
    );
    this.setTypeIfDifferent(
      merged,
      fromType,
      minimal,
      (n) => n.getValueType(),
      (n, t) => n.setValueType(t)
    );

    if (
      isNonNullable(merged.getName()) &&
      (isNullable(fromType) || merged.getName() !== fromType.getName())
    ) {
      minimal.setName(merged.getName());
    }
    if (
      isNonNullable(merged.getDescription()) &&
      (isNullable(fromType) ||
        merged.getDescription() !== fromType.getDescription())
    ) {
      minimal.setDescription(merged.getDescription());
    }

    if (
      isNonNullable(merged.getBlueId()) &&
      (isNullable(fromType) || merged.getBlueId() !== fromType.getBlueId())
    ) {
      minimal.setBlueId(merged.getBlueId());
    }

    const mergedItems = merged.getItems();
    if (isNonNullable(mergedItems)) {
      let start = 0;
      const minimalItems: BlueNode[] = [];
      const fromTypeItems = fromType?.getItems();
      if (isNonNullable(fromTypeItems)) {
        const itemsBlueId = BlueIdCalculator.calculateBlueIdSync(fromTypeItems);
        minimalItems.push(new BlueNode().setBlueId(itemsBlueId));
        start = fromTypeItems.length;
      }

      if (mergedItems.length > start) {
        for (let i = start; i < mergedItems.length; i++) {
          const item = mergedItems[i];
          const minimalItem = new BlueNode();
          this.reverseNode(minimalItem, item, undefined);
          minimalItems.push(minimalItem);
        }

        minimal.setItems(minimalItems);
      }
    }

    const mergedProperties = merged.getProperties();
    if (isNonNullable(mergedProperties)) {
      const minimalProperties: Record<string, BlueNode> = {};
      for (const [key, mergedProperty] of Object.entries(mergedProperties)) {
        // Get property from fromType (inherited from parent)
        let fromTypeProperty: BlueNode | undefined;
        const fromTypeProperties = fromType?.getProperties();
        if (isNonNullable(fromTypeProperties)) {
          fromTypeProperty = fromTypeProperties[key];
        }

        // Also consider property from merged node's own type
        let mergedTypeProperty: BlueNode | undefined;
        const mergedTypeProperties = merged.getType()?.getProperties();
        if (isNonNullable(mergedTypeProperties)) {
          mergedTypeProperty = mergedTypeProperties[key];
        }

        // If the property exists in the merged node's type, use it as the fromType
        // This handles cases where a node has its own type that contributes properties
        const effectiveFromType = mergedTypeProperty || fromTypeProperty;

        const minimalProperty = new BlueNode();
        this.reverseNode(minimalProperty, mergedProperty, effectiveFromType);

        if (!Nodes.isEmptyNode(minimalProperty)) {
          minimalProperties[key] = minimalProperty;
        }
      }
      if (Object.keys(minimalProperties).length > 0) {
        minimal.setProperties(minimalProperties);
      }
    }
  }

  private setTypeIfDifferent(
    merged: BlueNode,
    fromType: BlueNode | undefined,
    minimal: BlueNode,
    typeGetter: (node: BlueNode) => BlueNode | undefined,
    typeSetter: (node: BlueNode, typeNode: BlueNode) => BlueNode
  ): void {
    const mergedType = typeGetter(merged);
    const fromTypeType = fromType ? typeGetter(fromType) : undefined;
    const mergedTypeBlueId = mergedType?.getBlueId();

    if (
      isNonNullable(mergedTypeBlueId) &&
      (isNullable(fromType) ||
        isNullable(fromTypeType?.getBlueId()) ||
        fromTypeType?.getBlueId() !== mergedTypeBlueId)
    ) {
      const typeNode = new BlueNode().setBlueId(mergedTypeBlueId);
      typeSetter(minimal, typeNode);
    }
  }
}
