import { BlueNode } from '../model';
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
   */
  public merge(target: BlueNode, source: BlueNode, limits: Limits): void {
    if (isNonNullable(source.getBlue())) {
      throw new Error(
        'Document contains "blue" attribute. Preprocess document before merging.'
      );
    }

    const typeNode = source.getType();
    if (isNonNullable(typeNode)) {
      if (isNonNullable(typeNode.getBlueId())) {
        new NodeExtender(this.nodeProvider).extend(
          typeNode,
          PathLimits.withSinglePath('/')
        );
      }

      const resolvedType = this.resolve(typeNode, limits);
      source.setType(resolvedType);
      this.merge(target, typeNode, limits);
    }
    this.mergeObject(target, source, limits);
  }

  /**
   * Merges the properties and items of a source node into a target node
   * @param target - The target node to merge into
   * @param source - The source node to merge from
   * @param limits - The limits to apply during merging
   */
  private mergeObject(
    target: BlueNode,
    source: BlueNode,
    limits: Limits
  ): void {
    this.mergingProcessor.process(target, source, this.nodeProvider, this);

    const children = source.getItems();
    if (isNonNullable(children)) {
      this.mergeChildren(target, children, limits);
    }

    const properties = source.getProperties();
    if (isNonNullable(properties)) {
      Object.entries(properties).forEach(([key, value]) => {
        if (limits.shouldMergePathSegment(key, value)) {
          limits.enterPathSegment(key, value);
          this.mergeProperty(target, key, value, limits);
          limits.exitPathSegment();
        }
      });
    }

    if (isNonNullable(source.getBlueId())) {
      target.setBlueId(source.getBlueId());
    }

    if (this.mergingProcessor.postProcess) {
      this.mergingProcessor.postProcess(
        target,
        source,
        this.nodeProvider,
        this
      );
    }
  }

  /**
   * Merges child items from source into target
   * @param target - The target node
   * @param sourceChildren - The source children to merge
   * @param limits - The limits to apply
   */
  private mergeChildren(
    target: BlueNode,
    sourceChildren: BlueNode[],
    limits: Limits
  ): void {
    const targetChildren = target.getItems();
    if (isNullable(targetChildren)) {
      const filteredChildren = sourceChildren
        .filter((child, index) =>
          limits.shouldMergePathSegment(String(index), target)
        )
        .map((child) => {
          limits.enterPathSegment(
            String(sourceChildren.indexOf(child)),
            target
          );
          const resolvedChild = this.resolve(child, limits);
          limits.exitPathSegment();
          return resolvedChild;
        });
      target.setItems(filteredChildren);
      return;
    } else if (sourceChildren.length < targetChildren.length) {
      throw new Error(
        `Subtype of element must not have more items (${targetChildren.length}) than the element itself (${sourceChildren.length}).`
      );
    }

    for (let i = 0; i < sourceChildren.length; i++) {
      if (!limits.shouldMergePathSegment(String(i), sourceChildren[i])) {
        continue;
      }
      limits.enterPathSegment(String(i), sourceChildren[i]);
      if (i >= targetChildren.length) {
        targetChildren.push(sourceChildren[i]);
        limits.exitPathSegment();
        continue;
      }
      const sourceBlueId = BlueIdCalculator.calculateBlueIdSync(
        sourceChildren[i]
      );
      const targetBlueId = BlueIdCalculator.calculateBlueIdSync(
        targetChildren[i]
      );
      if (sourceBlueId !== targetBlueId) {
        throw new Error(
          `Mismatched items at index ${i}: source item has blueId '${sourceBlueId}', but target item has blueId '${targetBlueId}'.`
        );
      }
      limits.exitPathSegment();
    }
  }

  /**
   * Merges a property from source into target
   * @param target - The target node
   * @param sourceKey - The property key
   * @param sourceValue - The property value to merge
   * @param limits - The limits to apply
   */
  private mergeProperty(
    target: BlueNode,
    sourceKey: string,
    sourceValue: BlueNode,
    limits: Limits
  ): void {
    const node = this.resolve(sourceValue, limits);

    if (isNullable(target.getProperties())) {
      target.setProperties({});
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const targetValue = target.getProperties()![sourceKey];
    if (targetValue === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      target.getProperties()![sourceKey] = node;
    } else {
      this.mergeObject(targetValue, node, limits);
    }
  }

  /**
   * Resolves a node by creating a new node and merging the source into it
   * @param node - The node to resolve
   * @param limits - The limits to apply during resolution
   * @returns The resolved node
   */
  public resolve(node: BlueNode, limits: Limits): BlueNode {
    const resultNode = new BlueNode();
    this.merge(resultNode, node, limits);
    resultNode.setName(node.getName());
    resultNode.setDescription(node.getDescription());
    resultNode.setBlueId(node.getBlueId());
    return resultNode;
  }
}
