import { BlueNode } from '../model/Node';
import { Nodes } from './Nodes';
import { BlueIdCalculator } from './BlueIdCalculator';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';
import { ListControls } from './ListControls';

export class MergeReverser {
  constructor(
    /**
     * When true, minimization may emit list overlay controls such as $previous
     * and $pos for inherited lists. This is the storage/public minimal form.
     *
     * When false, inherited lists are emitted as full minimized item lists.
     * Use this only for hash-only normalization and item comparisons,
     * especially after $pos overlays have been resolved. $previous append-only
     * overlays can be hashed directly, but raw $pos must not reach the
     * low-level hasher.
     */
    private readonly options: { emitListControls?: boolean } = {
      emitListControls: true,
    },
  ) {}

  public reverse<T extends BlueNode>(mergedNode: T): BlueNode {
    const minimalNode = new BlueNode();
    this.reverseNode(minimalNode, mergedNode, undefined, true);
    return minimalNode;
  }

  public static calculateHashMinimalBlueId(node: BlueNode): string {
    return BlueIdCalculator.calculateBlueIdSync(this.toHashMinimalNode(node));
  }

  public static calculateHashMinimalListBlueId(items: BlueNode[]): string {
    return BlueIdCalculator.calculateBlueIdSync(
      items.map((item) => this.toHashMinimalNode(item)),
    );
  }

  private static toHashMinimalNode(node: BlueNode): BlueNode {
    return new MergeReverser({ emitListControls: false }).reverse(node);
  }

  private reverseNode(
    minimal: BlueNode,
    merged: BlueNode,
    externalFromType: BlueNode | undefined,
    isRoot: boolean,
  ): void {
    const effectiveFromType = this.getEffectiveFromType(
      externalFromType,
      merged,
    );

    if (!isRoot && this.isIdenticalToType(merged, effectiveFromType)) {
      return;
    }

    this.reverseBasicProperties(minimal, merged, effectiveFromType, isRoot);
    this.reverseTypeReferences(
      minimal,
      merged,
      externalFromType,
      effectiveFromType,
    );
    this.reverseItems(minimal, merged, effectiveFromType);
    this.reverseProperties(minimal, merged, effectiveFromType);
  }

  private isIdenticalToType(
    merged: BlueNode,
    fromType: BlueNode | undefined,
  ): boolean {
    return (
      isNonNullable(merged.getBlueId()) &&
      isNonNullable(fromType?.getBlueId()) &&
      merged.getBlueId() === fromType.getBlueId()
    );
  }

  private reverseBasicProperties(
    minimal: BlueNode,
    merged: BlueNode,
    fromType: BlueNode | undefined,
    isRoot: boolean,
  ): void {
    const mergedValue = merged.getValue();
    if (
      isNonNullable(mergedValue) &&
      (isNullable(fromType) || isNullable(fromType.getValue()))
    ) {
      minimal.setValue(mergedValue);
    }

    if (
      isNonNullable(merged.getName()) &&
      (isRoot ||
        isNullable(fromType) ||
        merged.getName() !== fromType.getName())
    ) {
      minimal.setName(merged.getName());
    }

    if (
      isNonNullable(merged.getDescription()) &&
      (isRoot ||
        isNullable(fromType) ||
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
  }

  private reverseTypeReferences(
    minimal: BlueNode,
    merged: BlueNode,
    externalFromType: BlueNode | undefined,
    effectiveFromType: BlueNode | undefined,
  ): void {
    const setIfDifferent = (
      getter: (node: BlueNode) => BlueNode | undefined,
      setter: (node: BlueNode, value: BlueNode) => void,
      fromType: BlueNode | undefined,
    ) => {
      const mergedTypeRef = getter(merged);
      const fromTypeRef = fromType ? getter(fromType) : undefined;

      if (
        isNonNullable(mergedTypeRef) &&
        !this.areTypeReferencesEquivalent(mergedTypeRef, fromTypeRef)
      ) {
        setter(minimal, this.toMinimalTypeReference(mergedTypeRef));
      }
    };

    setIfDifferent(
      (n) => n.getType(),
      (n, v) => n.setType(v),
      externalFromType,
    );
    setIfDifferent(
      (n) => n.getItemType(),
      (n, v) => n.setItemType(v),
      effectiveFromType,
    );
    setIfDifferent(
      (n) => n.getKeyType(),
      (n, v) => n.setKeyType(v),
      effectiveFromType,
    );
    setIfDifferent(
      (n) => n.getValueType(),
      (n, v) => n.setValueType(v),
      effectiveFromType,
    );
  }

  private areTypeReferencesEquivalent(
    mergedTypeRef: BlueNode,
    fromTypeRef: BlueNode | undefined,
  ): boolean {
    if (isNullable(fromTypeRef)) {
      return false;
    }

    const mergedBlueId = mergedTypeRef.getBlueId();
    const fromBlueId = fromTypeRef.getBlueId();
    if (isNonNullable(mergedBlueId) || isNonNullable(fromBlueId)) {
      return (
        isNonNullable(mergedBlueId) &&
        isNonNullable(fromBlueId) &&
        mergedBlueId === fromBlueId
      );
    }

    return (
      MergeReverser.calculateHashMinimalBlueId(mergedTypeRef) ===
      MergeReverser.calculateHashMinimalBlueId(fromTypeRef)
    );
  }

  private toMinimalTypeReference(typeRef: BlueNode): BlueNode {
    const blueId = typeRef.getBlueId();
    if (isNonNullable(blueId)) {
      return new BlueNode().setBlueId(blueId);
    }

    const minimalType = new BlueNode();
    this.reverseNode(minimalType, typeRef, undefined, true);
    return Nodes.isEmptyNode(minimalType) ? typeRef.clone() : minimalType;
  }

  private reverseItems(
    minimal: BlueNode,
    merged: BlueNode,
    fromType: BlueNode | undefined,
  ): void {
    const mergedItems = merged.getItems();
    if (isNullable(mergedItems)) {
      return;
    }

    const fromTypeItems = fromType?.getItems();
    if (mergedItems.length === 0) {
      if (isNullable(fromTypeItems) || fromTypeItems.length > 0) {
        minimal.setItems([]);
      }
      return;
    }

    if (
      isNonNullable(fromTypeItems) &&
      mergedItems.length === fromTypeItems.length &&
      mergedItems.every(
        (item, index) =>
          MergeReverser.calculateHashMinimalBlueId(item) ===
          MergeReverser.calculateHashMinimalBlueId(fromTypeItems[index]),
      )
    ) {
      return;
    }

    const minimalItems =
      this.options.emitListControls !== false &&
      isNonNullable(fromTypeItems) &&
      fromTypeItems.length > 0
        ? this.reverseInheritedItems(merged, fromType as BlueNode)
        : this.reverseFullItems(mergedItems);

    if (minimalItems.length > 0) {
      minimal.setItems(minimalItems);
    }
  }

  private reverseInheritedItems(
    merged: BlueNode,
    fromType: BlueNode,
  ): BlueNode[] {
    const mergedItems = merged.getItems() ?? [];
    const fromTypeItems = fromType.getItems() ?? [];
    if (mergedItems.length < fromTypeItems.length) {
      throw new Error(
        `Resolved list has fewer items (${mergedItems.length}) than inherited list (${fromTypeItems.length}).`,
      );
    }

    const mergePolicy = ListControls.getMergePolicy(merged, fromType);
    const changedIndexes: number[] = [];
    for (let i = 0; i < fromTypeItems.length; i++) {
      if (
        MergeReverser.calculateHashMinimalBlueId(mergedItems[i]) !==
        MergeReverser.calculateHashMinimalBlueId(fromTypeItems[i])
      ) {
        changedIndexes.push(i);
      }
    }

    if (changedIndexes.length > 0 && mergePolicy === 'append-only') {
      throw new Error(
        'append-only list cannot be minimized as a non-prefix mutation.',
      );
    }

    const previousListBlueId =
      MergeReverser.calculateHashMinimalListBlueId(fromTypeItems);
    const minimalItems = [ListControls.createPreviousItem(previousListBlueId)];

    for (const index of changedIndexes) {
      const positionalPayload = new BlueNode();
      this.reverseNode(
        positionalPayload,
        mergedItems[index],
        fromTypeItems[index],
        false,
      );
      const payload = Nodes.isEmptyNode(positionalPayload)
        ? mergedItems[index].clone()
        : positionalPayload;
      minimalItems.push(ListControls.createPositionedItem(index, payload));
    }

    for (let i = fromTypeItems.length; i < mergedItems.length; i++) {
      const minimalItem = new BlueNode();
      this.reverseNode(minimalItem, mergedItems[i], undefined, false);
      minimalItems.push(minimalItem);
    }

    return minimalItems.length === 1 ? [] : minimalItems;
  }

  private reverseFullItems(mergedItems: BlueNode[]): BlueNode[] {
    const minimalItems: BlueNode[] = [];
    for (let i = 0; i < mergedItems.length; i++) {
      const minimalItem = new BlueNode();
      this.reverseNode(minimalItem, mergedItems[i], undefined, false);
      minimalItems.push(minimalItem);
    }
    return minimalItems;
  }

  private reverseProperties(
    minimal: BlueNode,
    merged: BlueNode,
    fromType: BlueNode | undefined,
  ): void {
    const mergedProperties = merged.getProperties();
    if (isNullable(mergedProperties)) {
      return;
    }

    const minimalProperties: Record<string, BlueNode> = {};

    for (const [key, mergedProperty] of Object.entries(mergedProperties)) {
      const inheritedProperty = this.getInheritedProperty(key, fromType);

      const minimalProperty = new BlueNode();
      this.reverseNode(
        minimalProperty,
        mergedProperty,
        inheritedProperty,
        false,
      );

      if (!Nodes.isEmptyNode(minimalProperty)) {
        minimalProperties[key] = minimalProperty;
      }
    }

    if (Object.keys(minimalProperties).length > 0) {
      minimal.setProperties(minimalProperties);
    }
  }

  /**
   * Determines what a property inherits from after parent and own type overlays
   * have already been combined for the current node.
   */
  private getInheritedProperty(
    key: string,
    fromType: BlueNode | undefined,
  ): BlueNode | undefined {
    return fromType?.getProperties()?.[key];
  }

  private getEffectiveFromType(
    externalFromType: BlueNode | undefined,
    merged: BlueNode,
  ): BlueNode | undefined {
    const ownTypeOverlay = this.createOwnTypeOverlay(merged.getType());

    if (isNullable(externalFromType)) {
      return ownTypeOverlay;
    }

    if (isNullable(ownTypeOverlay)) {
      return externalFromType;
    }

    return this.mergeNodes(externalFromType, ownTypeOverlay);
  }

  private createOwnTypeOverlay(
    ownType: BlueNode | undefined,
  ): BlueNode | undefined {
    if (isNullable(ownType)) {
      return undefined;
    }

    const overlay = ownType
      .cloneShallow()
      .setName(undefined)
      .setDescription(undefined)
      .setType(undefined)
      .setBlueId(undefined);

    if (Nodes.isEmptyNode(overlay)) {
      return undefined;
    }

    return overlay;
  }

  /**
   * Merges two nodes, with the second node's properties taking precedence.
   * This represents what would be inherited when both parent and own types
   * contribute to a property.
   */
  private mergeNodes(base: BlueNode, overlay: BlueNode): BlueNode {
    const merged = base.clone();

    const overlayValue = overlay.getValue();
    if (isNonNullable(overlayValue)) {
      merged.setValue(overlayValue);
    }

    const overlayType = overlay.getType();
    if (isNonNullable(overlayType)) {
      merged.setType(overlayType.clone());
    }

    const overlayItemType = overlay.getItemType();
    if (isNonNullable(overlayItemType)) {
      merged.setItemType(overlayItemType.clone());
    }

    const overlayKeyType = overlay.getKeyType();
    if (isNonNullable(overlayKeyType)) {
      merged.setKeyType(overlayKeyType.clone());
    }

    const overlayValueType = overlay.getValueType();
    if (isNonNullable(overlayValueType)) {
      merged.setValueType(overlayValueType.clone());
    }

    const overlayProps = overlay.getProperties();
    if (isNonNullable(overlayProps)) {
      const mergedProps = merged.getProperties() || {};
      for (const [k, v] of Object.entries(overlayProps)) {
        const existing = mergedProps[k];
        mergedProps[k] =
          existing === undefined ? v.clone() : this.mergeNodes(existing, v);
      }
      merged.setProperties(mergedProps);
    }

    const overlayItems = overlay.getItems();
    if (isNonNullable(overlayItems)) {
      merged.setItems(overlayItems.map((item) => item.clone()));
    }

    return merged;
  }
}
