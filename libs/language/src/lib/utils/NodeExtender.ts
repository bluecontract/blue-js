import { isNonNullable } from '@blue-labs/shared-utils';
import { NodeProvider } from '../NodeProvider';
import { BlueNode } from '../model';
import { NodeProviderWrapper } from './NodeProviderWrapper';
import { CORE_TYPE_BLUE_IDS } from './Properties';
import { Limits } from './limits/Limits';
import { Nodes } from './Nodes';

/**
 * Strategies for handling missing elements
 */
export type MissingElementStrategy = 'THROW_EXCEPTION' | 'RETURN_EMPTY';

/**
 * Class for extending nodes with their resolved references
 */
export class NodeExtender {
  private nodeProvider: NodeProvider;
  private strategy: MissingElementStrategy;

  /**
   * Creates a new NodeExtender with the specified NodeProvider and optional strategy
   * @param nodeProvider - The NodeProvider to use for resolving nodes
   * @param strategy - The strategy to use for missing elements (defaults to THROW_EXCEPTION)
   */
  constructor(nodeProvider: NodeProvider, strategy?: MissingElementStrategy) {
    this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);
    this.strategy = strategy || 'THROW_EXCEPTION';
  }

  /**
   * Extends a node with its resolved references
   * @param node - The node to extend
   * @param limits - The limits to apply when extending
   */
  public extend(node: BlueNode, limits: Limits): void {
    this.extendNode(node, limits, '');
  }

  private extendNode(
    currentNode: BlueNode,
    currentLimits: Limits,
    currentSegment: string,
    skipLimitCheck = false,
  ): void {
    if (!skipLimitCheck) {
      if (!currentLimits.shouldExtendPathSegment(currentSegment, currentNode)) {
        return;
      }

      currentLimits.enterPathSegment(currentSegment, currentNode);
    }

    try {
      const blueId = currentNode.getBlueId();
      if (
        blueId &&
        Nodes.hasBlueIdOnly(currentNode) &&
        !CORE_TYPE_BLUE_IDS.includes(
          blueId as (typeof CORE_TYPE_BLUE_IDS)[number],
        )
      ) {
        const resolvedNodes = this.fetchNode(currentNode);
        if (resolvedNodes && resolvedNodes.length > 0) {
          const preserveReferenceBlueId = this.shouldPreserveReferenceBlueId(
            currentSegment,
            skipLimitCheck,
          );
          if (resolvedNodes.length === 1) {
            const resolvedNode = resolvedNodes[0];
            this.mergeNodes(currentNode, resolvedNode, preserveReferenceBlueId);
          } else {
            const mergedNodes = resolvedNodes.map((node) => node.clone());
            const listNode = new BlueNode().setItems(mergedNodes);
            this.mergeNodes(currentNode, listNode, preserveReferenceBlueId);
          }
        }
      }

      const typeNode = currentNode.getType();
      if (typeNode) {
        this.extendNode(typeNode, currentLimits, 'type', true);
      }
      const itemTypeNode = currentNode.getItemType();
      if (itemTypeNode) {
        this.extendNode(itemTypeNode, currentLimits, 'itemType', true);
      }
      const keyTypeNode = currentNode.getKeyType();
      if (keyTypeNode) {
        this.extendNode(keyTypeNode, currentLimits, 'keyType', true);
      }
      const valueTypeNode = currentNode.getValueType();
      if (valueTypeNode) {
        this.extendNode(valueTypeNode, currentLimits, 'valueType', true);
      }

      const properties = currentNode.getProperties();
      if (properties) {
        Object.entries(properties).forEach(([key, value]) => {
          this.extendNode(value, currentLimits, key, false);
        });
      }

      const items = currentNode.getItems();
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          this.extendNode(items[i], currentLimits, String(i), false);
        }
      }
    } finally {
      if (!skipLimitCheck) {
        currentLimits.exitPathSegment();
      }
    }
  }

  private fetchNode(node: BlueNode): BlueNode[] | null {
    const nodeBlueId = node.getBlueId();
    if (!nodeBlueId) {
      if (this.strategy === 'RETURN_EMPTY') {
        return null;
      } else {
        throw new Error(`No blueId found for node: ${node.getName()}`);
      }
    }

    const resolvedNodes = this.nodeProvider.fetchByBlueId(nodeBlueId);
    if (!resolvedNodes || resolvedNodes.length === 0) {
      if (this.strategy === 'RETURN_EMPTY') {
        return null;
      } else {
        throw new Error(`No content found for blueId: ${node.getBlueId()}`);
      }
    }
    return resolvedNodes;
  }

  private shouldPreserveReferenceBlueId(
    currentSegment: string,
    skipLimitCheck: boolean,
  ): boolean {
    return (
      skipLimitCheck &&
      ['type', 'itemType', 'keyType', 'valueType'].includes(currentSegment)
    );
  }

  private mergeNodes(
    target: BlueNode,
    source: BlueNode,
    preserveReferenceBlueId: boolean,
  ): void {
    if (!preserveReferenceBlueId) {
      target.setReferenceBlueId(undefined);
    }
    target.setName(source.getName());
    target.setDescription(source.getDescription());
    target.setType(source.getType()?.clone());
    target.setItemType(source.getItemType()?.clone());
    target.setKeyType(source.getKeyType()?.clone());
    target.setValueType(source.getValueType()?.clone());
    const sourceValue = source.getValue();
    if (isNonNullable(sourceValue)) {
      target.setValue(sourceValue);
    }
    target.setItems(source.getItems()?.map((item) => item.clone()));
    const sourceProperties = source.getProperties();
    target.setProperties(
      sourceProperties === undefined
        ? undefined
        : Object.fromEntries(
            Object.entries(sourceProperties).map(([key, value]) => [
              key,
              value.clone(),
            ]),
          ),
    );
    target.setBlue(source.getBlue()?.clone());
  }
}
