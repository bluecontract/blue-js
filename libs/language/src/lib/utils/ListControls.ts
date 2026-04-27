import { isNonNullable } from '@blue-labs/shared-utils';
import { BigIntegerNumber } from '../model/BigIntegerNumber';
import { BlueNode } from '../model/Node';
import { Nodes, NODE_FIELDS } from './Nodes';
import { OBJECT_MERGE_POLICY } from './Properties';

export const LIST_PREVIOUS_KEY = '$previous';
export const LIST_POSITION_KEY = '$pos';
export const LIST_EMPTY_KEY = '$empty';

export type ListMergePolicy = 'append-only' | 'positional';

export class ListControls {
  public static getMergePolicy(
    source: BlueNode,
    target?: BlueNode,
  ): ListMergePolicy {
    const sourcePolicy = this.getMergePolicyValue(source);
    if (sourcePolicy !== undefined) {
      return sourcePolicy;
    }

    const targetPolicy =
      target === undefined ? undefined : this.getMergePolicyValue(target);
    return targetPolicy ?? 'positional';
  }

  public static getMergePolicyValue(
    node: BlueNode,
  ): ListMergePolicy | undefined {
    const rawValue = node.getProperties()?.[OBJECT_MERGE_POLICY]?.getValue();
    if (rawValue === 'append-only' || rawValue === 'positional') {
      return rawValue;
    }
    return undefined;
  }

  public static hasListControlItems(items: BlueNode[] | undefined): boolean {
    return (
      items?.some(
        (item) =>
          this.hasPreviousProperty(item) || this.hasPositionProperty(item),
      ) ?? false
    );
  }

  public static hasAnyListControl(node: BlueNode): boolean {
    const items = node.getItems();
    if (this.hasListControlItems(items)) {
      return true;
    }

    if (items?.some((item) => this.hasAnyListControl(item))) {
      return true;
    }

    return (
      Object.values(node.getProperties() ?? {}).some((property) =>
        this.hasAnyListControl(property),
      ) ||
      this.hasAnyListControlChild(node.getType()) ||
      this.hasAnyListControlChild(node.getItemType()) ||
      this.hasAnyListControlChild(node.getKeyType()) ||
      this.hasAnyListControlChild(node.getValueType()) ||
      this.hasAnyListControlChild(node.getBlue())
    );
  }

  public static hasPositionControl(node: BlueNode): boolean {
    const items = node.getItems();
    if (items?.some((item) => this.hasPositionProperty(item))) {
      return true;
    }

    if (items?.some((item) => this.hasPositionControl(item))) {
      return true;
    }

    return (
      Object.values(node.getProperties() ?? {}).some((property) =>
        this.hasPositionControl(property),
      ) ||
      this.hasPositionControlChild(node.getType()) ||
      this.hasPositionControlChild(node.getItemType()) ||
      this.hasPositionControlChild(node.getKeyType()) ||
      this.hasPositionControlChild(node.getValueType()) ||
      this.hasPositionControlChild(node.getBlue())
    );
  }

  public static hasPreviousProperty(item: BlueNode): boolean {
    return Object.prototype.hasOwnProperty.call(
      item.getProperties() ?? {},
      LIST_PREVIOUS_KEY,
    );
  }

  public static hasPositionProperty(item: BlueNode): boolean {
    return Object.prototype.hasOwnProperty.call(
      item.getProperties() ?? {},
      LIST_POSITION_KEY,
    );
  }

  public static hasEmptyProperty(item: BlueNode): boolean {
    return Object.prototype.hasOwnProperty.call(
      item.getProperties() ?? {},
      LIST_EMPTY_KEY,
    );
  }

  public static isEmptyItem(item: BlueNode): boolean {
    const properties = item.getProperties();
    const emptyNode = properties?.[LIST_EMPTY_KEY];
    return (
      properties !== undefined &&
      Object.keys(properties).length === 1 &&
      emptyNode !== undefined &&
      Nodes.hasFieldsAndMayHaveFields(
        item,
        new Set([NODE_FIELDS.PROPERTIES]),
      ) &&
      Nodes.hasFieldsAndMayHaveFields(
        emptyNode,
        new Set([NODE_FIELDS.VALUE]),
        new Set([NODE_FIELDS.TYPE]),
      ) &&
      emptyNode.getValue() === true
    );
  }

  public static isPreviousItem(item: BlueNode): boolean {
    const properties = item.getProperties();
    return (
      properties !== undefined &&
      Object.keys(properties).length === 1 &&
      Nodes.hasFieldsAndMayHaveFields(
        item,
        new Set([NODE_FIELDS.PROPERTIES]),
      ) &&
      Nodes.hasBlueIdOnly(properties[LIST_PREVIOUS_KEY])
    );
  }

  public static getPreviousBlueId(item: BlueNode): string | undefined {
    if (!this.isPreviousItem(item)) {
      return undefined;
    }
    return item.getProperties()?.[LIST_PREVIOUS_KEY]?.getBlueId();
  }

  public static createPreviousItem(previousListBlueId: string): BlueNode {
    return new BlueNode().setProperties({
      [LIST_PREVIOUS_KEY]: new BlueNode().setBlueId(previousListBlueId),
    });
  }

  public static readPosition(item: BlueNode): number | undefined {
    const positionNode = item.getProperties()?.[LIST_POSITION_KEY];
    if (positionNode === undefined) {
      return undefined;
    }

    if (
      !Nodes.hasFieldsAndMayHaveFields(
        positionNode,
        new Set([NODE_FIELDS.VALUE]),
        new Set([NODE_FIELDS.TYPE]),
      )
    ) {
      throw new Error('$pos must be a non-negative integer value.');
    }

    const value = positionNode.getValue();
    const numberValue =
      value instanceof BigIntegerNumber
        ? value.toNumber()
        : typeof value === 'number'
          ? value
          : undefined;

    if (
      numberValue === undefined ||
      !Number.isInteger(numberValue) ||
      numberValue < 0
    ) {
      throw new Error('$pos must be a non-negative integer value.');
    }

    return numberValue;
  }

  public static createPositionedItem(
    position: number,
    payload: BlueNode,
  ): BlueNode {
    const positioned = payload.clone();
    positioned.addProperty(
      LIST_POSITION_KEY,
      new BlueNode().setValue(position),
    );
    return positioned;
  }

  public static withoutPosition(item: BlueNode): BlueNode {
    const payload = item.clone();
    const properties = payload.getProperties();
    if (properties !== undefined) {
      delete properties[LIST_POSITION_KEY];
      if (Object.keys(properties).length === 0) {
        payload.setProperties(undefined);
      }
    }
    return payload;
  }

  public static hasPayloadAfterRemovingPosition(item: BlueNode): boolean {
    return !Nodes.isEmptyNode(this.withoutPosition(item));
  }

  public static isReplacementPayload(payload: BlueNode): boolean {
    return (
      isNonNullable(payload.getValue()) ||
      isNonNullable(payload.getItems()) ||
      isNonNullable(payload.getBlueId())
    );
  }

  private static hasAnyListControlChild(node: BlueNode | undefined): boolean {
    return node !== undefined && this.hasAnyListControl(node);
  }

  private static hasPositionControlChild(node: BlueNode | undefined): boolean {
    return node !== undefined && this.hasPositionControl(node);
  }
}
