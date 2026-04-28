import { BlueNode } from '../model/Node';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';

export interface CyclicSetIdentityServiceOptions {
  prepareDocument?: (node: BlueNode) => BlueNode;
  calculateBlueId?: (value: BlueNode | BlueNode[]) => string;
}

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

  private readonly prepareDocument: (node: BlueNode) => BlueNode;
  private readonly calculateBlueId: (value: BlueNode | BlueNode[]) => string;

  constructor(options: CyclicSetIdentityServiceOptions = {}) {
    this.prepareDocument = options.prepareDocument ?? ((node) => node);
    this.calculateBlueId =
      options.calculateBlueId ?? BlueIdCalculator.calculateBlueIdSync;
  }

  public static hasThisReference(nodes: BlueNode[]): boolean {
    return nodes.some((node) => this.nodeHasThisReference(node));
  }

  public static hasIndexedThisReference(nodes: BlueNode[]): boolean {
    return nodes.some((node) => this.nodeHasIndexedThisReference(node));
  }

  public static isIndexedThisReference(referenceBlueId: string): boolean {
    return this.THIS_INDEX_REFERENCE_PATTERN.test(referenceBlueId);
  }

  public calculate(nodes: BlueNode[]): CyclicSetIdentityResult {
    this.validateCyclicSet(nodes);

    const preliminaryDocuments = nodes.map((node, originalIndex) => {
      const preliminaryNode = this.prepareDocument(
        this.replaceIndexedThisReferences(
          node,
          () => CyclicSetIdentityService.ZERO_BLUE_ID,
        ),
      );
      return {
        originalIndex,
        preliminaryBlueId: this.calculateBlueId(preliminaryNode),
        node,
      };
    });

    this.validateUniquePreliminaryBlueIds(preliminaryDocuments);

    const sortedDocuments = [...preliminaryDocuments].sort(
      this.comparePreliminaryDocuments,
    );
    const originalToSortedIndexes: number[] = [];
    sortedDocuments.forEach(({ originalIndex }, sortedIndex) => {
      originalToSortedIndexes[originalIndex] = sortedIndex;
    });

    const sortedNodes = sortedDocuments.map(({ node }) =>
      this.prepareDocument(
        this.replaceIndexedThisReferences(
          node,
          (originalIndex) => `this#${originalToSortedIndexes[originalIndex]}`,
        ),
      ),
    );
    const blueId = this.calculateBlueId(sortedNodes);

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
    return left.preliminaryBlueId.localeCompare(right.preliminaryBlueId);
  }

  private validateUniquePreliminaryBlueIds(
    preliminaryDocuments: PreliminaryDocument[],
  ): void {
    const firstOriginalIndexByBlueId = new Map<string, number>();
    for (const document of preliminaryDocuments) {
      const existingOriginalIndex = firstOriginalIndexByBlueId.get(
        document.preliminaryBlueId,
      );
      if (existingOriginalIndex !== undefined) {
        throw new Error(
          `Direct cyclic document set has ambiguous canonical ordering: documents ${existingOriginalIndex} and ${document.originalIndex} share preliminary BlueId '${document.preliminaryBlueId}'.`,
        );
      }

      firstOriginalIndexByBlueId.set(
        document.preliminaryBlueId,
        document.originalIndex,
      );
    }
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
