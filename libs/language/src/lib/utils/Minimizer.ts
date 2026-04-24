import { BlueNode } from '../model/Node';
import { Nodes } from './Nodes';
import { MergeReverser } from './MergeReverser';

export interface MinimizerOptions {
  allowMaterializedReferenceCollapse?: boolean;
  isTrustedMaterializedReference?: (
    node: BlueNode,
    referenceBlueId: string,
  ) => boolean;
}

export class Minimizer {
  private readonly mergeReverser = new MergeReverser();

  constructor(private readonly options: MinimizerOptions = {}) {}

  /**
   * Backwards-compatible entry point. New code should call the explicit
   * authoring/resolved/storage methods so it does not mix input contracts.
   */
  public minimize<T extends BlueNode>(node: T): BlueNode {
    return this.minimizeResolved(node);
  }

  public minimizeResolved<T extends BlueNode>(node: T): BlueNode {
    if (this.shouldCollapseMaterializedReference(node)) {
      return new BlueNode().setReferenceBlueId(node.getReferenceBlueId());
    }

    return this.mergeReverser.reverse(node);
  }

  public minimizeStorageOverlay<T extends BlueNode>(node: T): BlueNode {
    return this.mergeReverser.reverse(node);
  }

  private shouldCollapseMaterializedReference(node: BlueNode): boolean {
    const referenceBlueId = node.getReferenceBlueId();
    return (
      referenceBlueId !== undefined &&
      !Nodes.hasBlueIdOnly(node) &&
      this.options.allowMaterializedReferenceCollapse === true &&
      (this.options.isTrustedMaterializedReference?.(node, referenceBlueId) ??
        true)
    );
  }
}
