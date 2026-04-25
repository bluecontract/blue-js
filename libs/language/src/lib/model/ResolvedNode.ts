import { BlueNode } from './Node';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { Minimizer } from '../utils/Minimizer';

export type ResolvedNodeCompleteness = 'full' | 'path-limited';

export interface ResolvedBlueNodeMetadata {
  completeness?: ResolvedNodeCompleteness;
  sourceSemanticBlueId?: string;
}

/**
 * Represents a resolved BlueNode. This is a simple marker class that indicates
 * a node has been resolved through the merge process. The minimal/original
 * representation can be computed on demand using MergeReverser.
 */
export class ResolvedBlueNode extends BlueNode {
  private completeness: ResolvedNodeCompleteness;
  private sourceSemanticBlueId?: string;

  /**
   * Creates a new ResolvedBlueNode from a resolved BlueNode
   * @param resolvedNode - The fully resolved node after merge operations
   */
  constructor(resolvedNode: BlueNode, metadata: ResolvedBlueNodeMetadata = {}) {
    super(resolvedNode.getName());
    this.completeness = metadata.completeness ?? 'full';
    this.sourceSemanticBlueId = metadata.sourceSemanticBlueId;
    this.createFrom(resolvedNode);
  }

  /**
   * Checks if this is a resolved node
   * @returns Always returns true for ResolvedBlueNode instances
   */
  public override isResolved(): boolean {
    return true;
  }

  /**
   * Gets the minimal representation of this node.
   * This represents the node without any properties inherited from type resolution.
   *
   * @returns The minimal node representation
   */
  public getMinimalNode(): BlueNode {
    if (this.completeness === 'path-limited') {
      if (this.sourceSemanticBlueId !== undefined) {
        return new BlueNode().setReferenceBlueId(this.sourceSemanticBlueId);
      }
      throw new Error(
        'Cannot minimize a path-limited resolved node without a source semantic BlueId.',
      );
    }

    const minimizer = new Minimizer();
    return minimizer.minimizeResolved(this);
  }

  public getMinimalBlueId(): string {
    if (this.completeness === 'path-limited') {
      if (this.sourceSemanticBlueId !== undefined) {
        return this.sourceSemanticBlueId;
      }
      throw new Error(
        'Cannot calculate minimal BlueId for a path-limited resolved node without a source semantic BlueId.',
      );
    }

    const minimalNode = this.getMinimalNode();
    return BlueIdCalculator.calculateBlueIdSync(minimalNode);
  }

  /**
   * Creates a clone of this ResolvedBlueNode
   * @returns A new ResolvedBlueNode with the same state
   */
  public override clone(): ResolvedBlueNode {
    const clonedBase = super.clone();
    return new ResolvedBlueNode(clonedBase, this.getMetadata());
  }

  /**
   * Creates a shallow clone of this ResolvedBlueNode while preserving
   * the resolved marker type.
   * @returns A new ResolvedBlueNode with shallow-copied containers
   */
  public override cloneShallow(): ResolvedBlueNode {
    const clonedBase = super.cloneShallow();
    return new ResolvedBlueNode(clonedBase, this.getMetadata());
  }

  public getCompleteness(): ResolvedNodeCompleteness {
    return this.completeness;
  }

  public getSourceSemanticBlueId(): string | undefined {
    return this.sourceSemanticBlueId;
  }

  public setSourceSemanticBlueId(blueId: string | undefined): this {
    this.sourceSemanticBlueId = blueId;
    return this;
  }

  private getMetadata(): ResolvedBlueNodeMetadata {
    return {
      completeness: this.completeness,
      sourceSemanticBlueId: this.sourceSemanticBlueId,
    };
  }

  /**
   * Copies all properties from another BlueNode
   * @param source - The node to copy properties from
   */
  private createFrom(source: BlueNode): void {
    // Only copy if different from what was set in super()
    if (source.getName() !== this.getName()) {
      this.setName(source.getName());
    }

    this.setDescription(source.getDescription())
      .setType(source.getType())
      .setItemType(source.getItemType())
      .setKeyType(source.getKeyType())
      .setValueType(source.getValueType())
      .setItems(source.getItems())
      .setProperties(source.getProperties())
      .setBlueId(source.getBlueId())
      .setBlue(source.getBlue())
      .setInlineValue(source.isInlineValue());

    const value = source.getValue();
    if (value !== undefined) {
      this.setValue(value);
    }
  }
}
