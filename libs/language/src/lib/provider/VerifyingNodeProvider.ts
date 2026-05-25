import { BlueNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { BlueIds } from '../utils/BlueIds';

export class VerifyingNodeProvider extends NodeProvider {
  constructor(private readonly delegate: NodeProvider) {
    super();
  }

  override fetchByBlueId(blueId: string): BlueNode[] | null {
    let requestedBlueId: string;
    try {
      requestedBlueId = BlueIds.requireBlueIdOrCyclicMember(
        blueId,
        'provider.fetchByBlueId',
      );
    } catch {
      return this.delegate.fetchByBlueId(blueId);
    }
    const nodes = this.delegate.fetchByBlueId(blueId);
    if (nodes === null || nodes.length === 0) {
      return nodes;
    }

    if (requestedBlueId.includes('#')) {
      return nodes;
    }

    const actualBlueId =
      nodes.length === 1
        ? BlueIdCalculator.calculateBlueIdSync(
            this.contentWithoutRootIdentity(nodes[0]),
          )
        : BlueIdCalculator.calculateBlueIdSync(
            nodes.map((node) => this.contentWithoutRootIdentity(node)),
          );

    if (actualBlueId !== requestedBlueId) {
      if (this.verifyCyclicSetContent(requestedBlueId, nodes)) {
        return nodes;
      }
      throw new Error(
        `Provider returned content with BlueId ${actualBlueId} for requested BlueId ${requestedBlueId}.`,
      );
    }

    return nodes;
  }

  private contentWithoutRootIdentity(node: BlueNode): BlueNode {
    const canonical = node.clone();
    if (
      canonical.getReferenceBlueId() !== undefined &&
      !this.isReferenceOnly(canonical)
    ) {
      canonical.setReferenceBlueId(undefined);
    }
    return canonical;
  }

  private isReferenceOnly(node: BlueNode): boolean {
    return (
      node.getReferenceBlueId() !== undefined &&
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getValueType() === undefined &&
      node.getValue() === undefined &&
      node.getItems() === undefined &&
      Object.keys(node.getProperties() ?? {}).length === 0 &&
      node.getContractsNode() === undefined &&
      node.getSchema() === undefined &&
      node.getMergePolicy() === undefined &&
      node.getPreviousBlueId() === undefined &&
      node.getPosition() === undefined &&
      node.getBlue() === undefined
    );
  }

  private verifyCyclicSetContent(
    requestedBlueId: string,
    nodes: BlueNode[],
  ): boolean {
    if (nodes.length === 0) {
      return false;
    }
    const rewritten = nodes.map((node) => {
      const clone = node.clone();
      this.rewriteCyclicMemberReferences(clone, requestedBlueId);
      return clone;
    });
    const hasInternalReference = rewritten.some((node) =>
      this.hasThisReference(node),
    );
    if (!hasInternalReference) {
      return false;
    }
    try {
      return (
        BlueIdCalculator.calculateBlueIdAllowingCyclicPlaceholdersSync(
          rewritten,
        ) === requestedBlueId
      );
    } catch {
      return false;
    }
  }

  private rewriteCyclicMemberReferences(
    node: BlueNode,
    masterBlueId: string,
  ): void {
    const referenceBlueId = node.getReferenceBlueId();
    if (referenceBlueId?.startsWith(`${masterBlueId}#`)) {
      node.setReferenceBlueId(
        `this#${referenceBlueId.slice(masterBlueId.length + 1)}`,
      );
    }

    this.childrenOf(node).forEach((child) =>
      this.rewriteCyclicMemberReferences(child, masterBlueId),
    );
  }

  private hasThisReference(node: BlueNode): boolean {
    const referenceBlueId = node.getReferenceBlueId();
    if (referenceBlueId?.startsWith('this#')) {
      return true;
    }
    return this.childrenOf(node).some((child) => this.hasThisReference(child));
  }

  private childrenOf(node: BlueNode): BlueNode[] {
    return [
      node.getType(),
      node.getItemType(),
      node.getKeyType(),
      node.getValueType(),
      node.getBlue(),
      node.getContractsNode(),
      ...((node
        .getSchema()
        ?.entries()
        .map(([, value]) => value) ?? []) as BlueNode[]),
      ...(node.getSchema()?.getEnum() ?? []),
      ...(node.getItems() ?? []),
      ...Object.values(node.getProperties() ?? {}),
    ].filter((child): child is BlueNode => child !== undefined);
  }
}
