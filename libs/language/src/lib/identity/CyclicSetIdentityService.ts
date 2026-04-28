import { BlueNode } from '../model/Node';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';

export interface CyclicSetIdentityResult {
  blueId: string;
  nodes: BlueNode[];
  documentBlueIds: string[];
  originalToSortedIndexes: number[];
}

interface PreliminaryDocument {
  originalIndex: number;
  preliminaryBlueId: string;
  node: BlueNode;
}

type ReferenceVisitor = (node: BlueNode, referenceBlueId: string) => void;

export class CyclicSetIdentityService {
  public static readonly ZERO_BLUE_ID = '0'.repeat(44);

  private static readonly THIS_INDEX_REFERENCE_PATTERN = /^this#(\d+)$/;

  public static hasThisReference(nodes: BlueNode[]): boolean {
    return nodes.some((node) => this.nodeHasThisReference(node));
  }

  public static hasIndexedThisReference(nodes: BlueNode[]): boolean {
    return nodes.some((node) => this.nodeHasIndexedThisReference(node));
  }

  public calculate(nodes: BlueNode[]): CyclicSetIdentityResult {
    this.validateCyclicSet(nodes);

    const preliminaryDocuments = nodes.map((node, originalIndex) => ({
      originalIndex,
      preliminaryBlueId: BlueIdCalculator.calculateBlueIdSync(
        this.replaceIndexedThisReferences(
          node,
          () => CyclicSetIdentityService.ZERO_BLUE_ID,
        ),
      ),
      node,
    }));

    const sortedDocuments = [...preliminaryDocuments].sort(
      this.comparePreliminaryDocuments,
    );
    const originalToSortedIndexes: number[] = [];
    sortedDocuments.forEach(({ originalIndex }, sortedIndex) => {
      originalToSortedIndexes[originalIndex] = sortedIndex;
    });

    const sortedNodes = sortedDocuments.map(({ node }) =>
      this.replaceIndexedThisReferences(
        node,
        (originalIndex) => `this#${originalToSortedIndexes[originalIndex]}`,
      ),
    );
    const blueId = BlueIdCalculator.calculateBlueIdSync(sortedNodes);

    return {
      blueId,
      nodes: sortedNodes,
      documentBlueIds: sortedNodes.map((_, index) => `${blueId}#${index}`),
      originalToSortedIndexes,
    };
  }

  private comparePreliminaryDocuments(
    left: PreliminaryDocument,
    right: PreliminaryDocument,
  ): number {
    const byPreliminaryBlueId = left.preliminaryBlueId.localeCompare(
      right.preliminaryBlueId,
    );
    if (byPreliminaryBlueId !== 0) {
      return byPreliminaryBlueId;
    }

    return left.originalIndex - right.originalIndex;
  }

  private validateCyclicSet(nodes: BlueNode[]): void {
    if (nodes.length === 0) {
      throw new Error('Cyclic document set cannot be empty.');
    }

    this.visitReferences(nodes, (_node, referenceBlueId) => {
      if (referenceBlueId === 'this') {
        throw new Error(
          "Direct cyclic document sets must use indexed references such as 'this#0'; unindexed 'this' is not supported in phase 3A.",
        );
      }

      if (
        referenceBlueId.startsWith('this#') &&
        !CyclicSetIdentityService.THIS_INDEX_REFERENCE_PATTERN.test(
          referenceBlueId,
        )
      ) {
        throw new Error(
          `Malformed direct cyclic reference '${referenceBlueId}'. Expected 'this#<non-negative-integer>'.`,
        );
      }

      const index = this.readIndexedThisReference(referenceBlueId);
      if (index !== undefined && index >= nodes.length) {
        throw new Error(
          `Direct cyclic reference '${referenceBlueId}' points outside the ${nodes.length}-document set.`,
        );
      }
    });
  }

  private replaceIndexedThisReferences(
    node: BlueNode,
    replacement: (originalIndex: number) => string,
  ): BlueNode {
    const cloned = node.clone();
    this.rewriteIndexedThisReferences(cloned, replacement);
    return cloned;
  }

  private rewriteIndexedThisReferences(
    node: BlueNode,
    replacement: (originalIndex: number) => string,
  ): void {
    const referenceBlueId = node.getReferenceBlueId();
    if (referenceBlueId !== undefined) {
      const index = this.readIndexedThisReference(referenceBlueId);
      if (index !== undefined) {
        node.setReferenceBlueId(replacement(index));
      }
    }

    this.childrenOf(node).forEach((child) =>
      this.rewriteIndexedThisReferences(child, replacement),
    );
  }

  private static nodeHasThisReference(node: BlueNode): boolean {
    let found = false;
    this.visitNodeReferences(node, (_node, referenceBlueId) => {
      if (referenceBlueId === 'this' || referenceBlueId.startsWith('this#')) {
        found = true;
      }
    });
    return found;
  }

  private static nodeHasIndexedThisReference(node: BlueNode): boolean {
    let found = false;
    this.visitNodeReferences(node, (_node, referenceBlueId) => {
      if (
        CyclicSetIdentityService.THIS_INDEX_REFERENCE_PATTERN.test(
          referenceBlueId,
        )
      ) {
        found = true;
      }
    });
    return found;
  }

  private visitReferences(nodes: BlueNode[], visitor: ReferenceVisitor): void {
    nodes.forEach((node) =>
      CyclicSetIdentityService.visitNodeReferences(node, visitor),
    );
  }

  private static visitNodeReferences(
    node: BlueNode,
    visitor: ReferenceVisitor,
  ): void {
    const referenceBlueId = node.getReferenceBlueId();
    if (referenceBlueId !== undefined) {
      visitor(node, referenceBlueId);
    }

    this.childrenOf(node).forEach((child) =>
      this.visitNodeReferences(child, visitor),
    );
  }

  private readIndexedThisReference(
    referenceBlueId: string,
  ): number | undefined {
    const match = referenceBlueId.match(
      CyclicSetIdentityService.THIS_INDEX_REFERENCE_PATTERN,
    );
    if (match === null) {
      return undefined;
    }

    return Number(match[1]);
  }

  private childrenOf(node: BlueNode): BlueNode[] {
    return CyclicSetIdentityService.childrenOf(node);
  }

  private static childrenOf(node: BlueNode): BlueNode[] {
    return [
      node.getType(),
      node.getItemType(),
      node.getKeyType(),
      node.getValueType(),
      node.getBlue(),
      ...(node.getItems() ?? []),
      ...Object.values(node.getProperties() ?? {}),
    ].filter((child): child is BlueNode => child !== undefined);
  }
}
