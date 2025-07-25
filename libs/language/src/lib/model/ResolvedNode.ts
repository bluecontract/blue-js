import { BlueNode } from './Node';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { JsonPrimitive } from '@blue-labs/shared-utils';
import { BigIntegerNumber } from './BigIntegerNumber';
import { BigDecimalNumber } from './BigDecimalNumber';

/**
 * A wrapper class that represents a resolved BlueNode while preserving the original node.
 * This allows access to both the resolved state and the original state of a node,
 * including the original blueId before resolution.
 */
export class ResolvedNode {
  private readonly originalNode: BlueNode;
  private readonly resolvedNode: BlueNode;
  private cachedOriginalBlueId?: string;

  constructor(originalNode: BlueNode, resolvedNode: BlueNode) {
    this.originalNode = originalNode;
    this.resolvedNode = resolvedNode;
  }

  /**
   * Creates a ResolvedNode from an original node and its resolved version
   */
  static from(originalNode: BlueNode, resolvedNode: BlueNode): ResolvedNode {
    return new ResolvedNode(originalNode, resolvedNode);
  }

  /**
   * Creates a ResolvedNode where the original and resolved are the same (unresolved node)
   */
  static unresolved(node: BlueNode): ResolvedNode {
    return new ResolvedNode(node, node);
  }

  /**
   * Gets the original unresolved node
   */
  getOriginalNode(): BlueNode {
    return this.originalNode;
  }

  /**
   * Gets the resolved node
   */
  getResolvedNode(): BlueNode {
    return this.resolvedNode;
  }

  /**
   * Gets the original blueId (calculated from the original node)
   */
  getOriginalBlueId(): string {
    if (!this.cachedOriginalBlueId) {
      this.cachedOriginalBlueId = BlueIdCalculator.calculateBlueIdSync(
        this.originalNode
      );
    }
    return this.cachedOriginalBlueId;
  }

  /**
   * Gets the resolved blueId (calculated from the resolved node)
   */
  getResolvedBlueId(): string {
    return BlueIdCalculator.calculateBlueIdSync(this.resolvedNode);
  }

  /**
   * Checks if this node has been resolved (i.e., if the resolved node differs from the original)
   */
  isResolved(): boolean {
    return this.getOriginalBlueId() !== this.getResolvedBlueId();
  }

  /**
   * Converts this ResolvedNode back to a regular BlueNode (returns the resolved version)
   */
  toBlueNode(): BlueNode {
    return this.resolvedNode;
  }

  // Delegate common BlueNode methods to the resolved node

  getName(): string | undefined {
    return this.resolvedNode.getName();
  }

  getDescription(): string | undefined {
    return this.resolvedNode.getDescription();
  }

  getType(): BlueNode | undefined {
    return this.resolvedNode.getType();
  }

  getItemType(): BlueNode | undefined {
    return this.resolvedNode.getItemType();
  }

  getKeyType(): BlueNode | undefined {
    return this.resolvedNode.getKeyType();
  }

  getValueType(): BlueNode | undefined {
    return this.resolvedNode.getValueType();
  }

  getValue():
    | Exclude<JsonPrimitive, number>
    | BigIntegerNumber
    | BigDecimalNumber
    | undefined {
    return this.resolvedNode.getValue();
  }

  getItems(): BlueNode[] | undefined {
    return this.resolvedNode.getItems();
  }

  getProperties(): Record<string, BlueNode> | undefined {
    return this.resolvedNode.getProperties();
  }

  getBlueId(): string | undefined {
    return this.resolvedNode.getBlueId();
  }

  getBlue(): BlueNode | undefined {
    return this.resolvedNode.getBlue();
  }

  getContracts(): Record<string, BlueNode> | undefined {
    return this.resolvedNode.getContracts();
  }

  get(
    path: string,
    linkingProvider?: (node: BlueNode) => BlueNode | null
  ):
    | BlueNode
    | string
    | boolean
    | BigIntegerNumber
    | BigDecimalNumber
    | null
    | undefined {
    return this.resolvedNode.get(path, linkingProvider);
  }

  getAsNode(path: string): BlueNode | undefined {
    return this.resolvedNode.getAsNode(path);
  }

  getAsInteger(path: string): number | undefined {
    return this.resolvedNode.getAsInteger(path);
  }

  /**
   * Creates a new ResolvedNode with a modified resolved node while preserving the original
   */
  withResolvedNode(modifiedResolvedNode: BlueNode): ResolvedNode {
    return new ResolvedNode(this.originalNode, modifiedResolvedNode);
  }

  /**
   * Clones this ResolvedNode
   */
  clone(): ResolvedNode {
    return new ResolvedNode(
      this.originalNode.clone(),
      this.resolvedNode.clone()
    );
  }

  toString(): string {
    return `ResolvedNode{isResolved=${this.isResolved()}, originalBlueId='${this.getOriginalBlueId()}', resolvedBlueId='${this.getResolvedBlueId()}'}`;
  }
}
