import { BlueNode, ResolvedNode } from '../model';
import { NodeProvider } from '../NodeProvider';
import { NodeResolver } from './NodeResolver';
import { MergingProcessor } from './MergingProcessor';
import { NodeExtender } from '../utils/NodeExtender';
import { NodeProviderWrapper } from '../utils/NodeProviderWrapper';
import { Limits } from '../utils/limits/Limits';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { PathLimits } from '../utils/limits/PathLimits';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';

/**
 * Merger class that implements NodeResolver for merging nodes
 */
export class Merger extends NodeResolver {
  private mergingProcessor: MergingProcessor;
  private nodeProvider: NodeProvider;

  /**
   * Creates a new Merger with the specified MergingProcessor and NodeProvider
   * @param mergingProcessor - The processor to use for merge operations
   * @param nodeProvider - The provider to use for resolving nodes
   */
  constructor(mergingProcessor: MergingProcessor, nodeProvider: NodeProvider) {
    super();
    this.mergingProcessor = mergingProcessor;
    this.nodeProvider = NodeProviderWrapper.wrap(nodeProvider);
  }

  /**
   * Merges a source node into a target node with the given limits
   * @param target - The target node to merge into
   * @param source - The source node to merge from
   * @param limits - The limits to apply during merging
   * @returns A new BlueNode with the merged content
   */
  public merge(target: BlueNode, source: BlueNode, limits: Limits): BlueNode {
    if (isNonNullable(source.getBlue())) {
      throw new Error(
        'Document contains "blue" attribute. Preprocess document before merging.'
      );
    }

    let newTarget = target;
    const typeNode = source.getType();

    if (isNonNullable(typeNode)) {
      const clonedTypeNode = typeNode.clone();
      if (isNonNullable(clonedTypeNode.getBlueId())) {
        new NodeExtender(this.nodeProvider).extend(
          clonedTypeNode,
          PathLimits.withSinglePath('/')
        );
      }

      const resolvedType = this.resolveToNode(clonedTypeNode, limits);
      const sourceWithResolvedType = source.clone().setType(resolvedType);
      newTarget = this.merge(newTarget, clonedTypeNode, limits);
      return this.mergeObject(newTarget, sourceWithResolvedType, limits);
    }
    return this.mergeObject(newTarget, source, limits);
  }

  /**
   * Merges the properties and items of a source node into a target node
   * @param target - The target node to merge into
   * @param source - The source node to merge from
   * @param limits - The limits to apply during merging
   * @returns A new BlueNode with the merged content
   */
  private mergeObject(
    target: BlueNode,
    source: BlueNode,
    limits: Limits
  ): BlueNode {
    let newTarget = this.mergingProcessor.process(
      target,
      source,
      this.nodeProvider
    );

    const children = source.getItems();
    if (isNonNullable(children)) {
      newTarget = this.mergeChildren(newTarget, children, limits);
    }

    const properties = source.getProperties();
    if (isNonNullable(properties)) {
      Object.entries(properties).forEach(([key, value]) => {
        if (limits.shouldMergePathSegment(key, value)) {
          limits.enterPathSegment(key, value);
          newTarget = this.mergeProperty(newTarget, key, value, limits);
          limits.exitPathSegment();
        }
      });
    }

    if (isNonNullable(source.getBlueId())) {
      newTarget = newTarget.clone().setBlueId(source.getBlueId());
    }

    if (this.mergingProcessor.postProcess) {
      newTarget = this.mergingProcessor.postProcess(
        newTarget,
        source,
        this.nodeProvider
      );
    }
    return newTarget;
  }

  /**
   * Merges child items from source into target
   * @param target - The target node
   * @param sourceChildren - The source children to merge
   * @param limits - The limits to apply
   * @returns A new BlueNode with the merged children
   */
  private mergeChildren(
    target: BlueNode,
    sourceChildren: BlueNode[],
    limits: Limits
  ): BlueNode {
    const targetChildren = target.getItems();
    if (isNullable(targetChildren)) {
      const filteredChildren = sourceChildren
        .filter((child, index) =>
          limits.shouldMergePathSegment(String(index), child)
        )
        .map((child) => {
          limits.enterPathSegment(String(sourceChildren.indexOf(child)), child);
          const resolvedChild = this.resolveToNode(child, limits);
          limits.exitPathSegment();
          return resolvedChild;
        });
      return target.clone().setItems(filteredChildren);
    } else if (sourceChildren.length < targetChildren.length) {
      throw new Error(
        `Subtype of element must not have more items (${targetChildren.length}) than the element itself (${sourceChildren.length}).`
      );
    }

    const newTargetChildren = [...targetChildren];
    for (let i = 0; i < sourceChildren.length; i++) {
      if (!limits.shouldMergePathSegment(String(i), sourceChildren[i])) {
        continue;
      }
      limits.enterPathSegment(String(i), sourceChildren[i]);
      if (i >= newTargetChildren.length) {
        newTargetChildren.push(sourceChildren[i]);
        limits.exitPathSegment();
        continue;
      }
      const sourceBlueId = BlueIdCalculator.calculateBlueIdSync(
        sourceChildren[i]
      );
      const targetBlueId = BlueIdCalculator.calculateBlueIdSync(
        newTargetChildren[i]
      );
      if (sourceBlueId !== targetBlueId) {
        throw new Error(
          `Mismatched items at index ${i}: source item has blueId '${sourceBlueId}', but target item has blueId '${targetBlueId}'.`
        );
      }
      limits.exitPathSegment();
    }
    return target.clone().setItems(newTargetChildren);
  }

  /**
   * Merges a property from source into target
   * @param target - The target node
   * @param sourceKey - The property key
   * @param sourceValue - The property value to merge
   * @param limits - The limits to apply
   * @returns A new BlueNode with the merged property
   */
  private mergeProperty(
    target: BlueNode,
    sourceKey: string,
    sourceValue: BlueNode,
    limits: Limits
  ): BlueNode {
    const node = this.resolveToNode(sourceValue, limits);
    const newTarget = target.clone();

    if (isNullable(newTarget.getProperties())) {
      newTarget.setProperties({});
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetValue = newTarget.getProperties()![sourceKey];
    if (targetValue === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newTarget.getProperties()![sourceKey] = node;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      newTarget.getProperties()![sourceKey] = this.mergeObject(
        targetValue,
        node,
        limits
      );
    }
    return newTarget;
  }

  /**
   * Resolves a node by creating a new node and merging the source into it
   * @param node - The node to resolve
   * @param limits - The limits to apply during resolution
   * @returns The resolved node
   */
  public resolve(node: BlueNode, limits: Limits): BlueNode {
    const resultNode = new BlueNode();
    const mergedNode = this.merge(resultNode, node, limits);
    return mergedNode
      .clone()
      .setName(node.getName())
      .setDescription(node.getDescription())
      .setBlueId(node.getBlueId());
  }

  /**
   * Resolves a node and returns a ResolvedNode containing both original and resolved versions
   * @param node - The node to resolve
   * @param limits - The limits to apply during resolution
   * @returns The resolved node wrapped in a ResolvedNode
   */
  public resolveToResolvedNode(node: BlueNode, limits: Limits): ResolvedNode {
    const originalNode = node.clone(); // Clone to preserve the original
    const resolvedNode = this.resolve(node, limits);
    return ResolvedNode.from(originalNode, resolvedNode);
  }

  /**
   * Internal resolve method that returns a BlueNode for backward compatibility
   * @param node - The node to resolve
   * @param limits - The limits to apply during resolution
   * @returns The resolved node
   */
  private resolveToNode(node: BlueNode, limits: Limits): BlueNode {
    return this.resolve(node, limits);
  }
}
