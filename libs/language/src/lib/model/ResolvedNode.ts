import { BlueNode } from './Node';
import { MergeReverser } from '../utils/MergeReverser';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';

/**
 * Represents a resolved BlueNode. This is a simple marker class that indicates
 * a node has been resolved through the merge process. The minimal/original
 * representation can be computed on demand using MergeReverser.
 */
export class ResolvedNode extends BlueNode {
  /**
   * Creates a new ResolvedNode from a resolved BlueNode
   * @param resolvedNode - The fully resolved node after merge operations
   */
  constructor(resolvedNode: BlueNode) {
    // Initialize with the resolved node's name
    super(resolvedNode.getName());

    // Copy all properties from the resolved node
    this.copyFrom(resolvedNode);
  }

  /**
   * Checks if this is a resolved node
   * @returns Always returns true for ResolvedNode instances
   */
  override isResolved(): boolean {
    return true;
  }

  /**
   * Gets the minimal representation of this node.
   * This represents the node without any properties inherited from type resolution.
   *
   * @returns The minimal node representation
   */
  getMinimalNode(): BlueNode {
    const reverser = new MergeReverser();
    return reverser.reverse(this);
  }

  /**
   * Gets the blueId of the minimal representation.
   * This is the blueId of the node without inherited properties.
   *
   * @returns The blueId of the minimal node
   */
  getMinimalBlueId(): string {
    const minimalNode = this.getMinimalNode();
    return BlueIdCalculator.calculateBlueIdSync(minimalNode);
  }

  /**
   * Creates a clone of this ResolvedNode
   * @returns A new ResolvedNode with the same state
   */
  override clone(): ResolvedNode {
    const clonedBase = super.clone();
    return new ResolvedNode(clonedBase);
  }

  /**
   * Copies all properties from another BlueNode
   * @param source - The node to copy properties from
   */
  private copyFrom(source: BlueNode): void {
    // Only copy if different from what was set in super()
    if (source.getName() !== this.getName()) {
      this.setName(source.getName());
    }

    this.setDescription(source.getDescription());
    this.setType(source.getType()?.clone());
    this.setItemType(source.getItemType()?.clone());
    this.setKeyType(source.getKeyType()?.clone());
    this.setValueType(source.getValueType()?.clone());

    const value = source.getValue();
    if (value !== undefined) {
      this.setValue(value);
    }

    this.setItems(source.getItems()?.map((item) => item.clone()));

    const sourceProperties = source.getProperties();
    if (sourceProperties) {
      this.setProperties(
        Object.fromEntries(
          Object.entries(sourceProperties).map(([k, v]) => [k, v.clone()])
        )
      );
    }

    this.setBlueId(source.getBlueId());
    this.setBlue(source.getBlue()?.clone());
    this.setInlineValue(source.isInlineValue());
  }

  /**
   * Creates a ResolvedNode from a regular BlueNode
   * @param node - The node to wrap as resolved
   * @returns A new ResolvedNode
   */
  static fromNode(node: BlueNode): ResolvedNode {
    // If it's already a ResolvedNode, clone it
    if (node instanceof ResolvedNode) {
      return node.clone();
    }

    return new ResolvedNode(node);
  }
}
