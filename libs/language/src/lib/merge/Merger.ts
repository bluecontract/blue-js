import { BlueNode } from '../model';
import { ResolvedBlueNode } from '../model/ResolvedNode';
import { NodeProvider } from '../NodeProvider';
import { NodeResolver } from './NodeResolver';
import { MergingProcessor } from './MergingProcessor';
import { NodeExtender } from '../utils/NodeExtender';
import { NodeProviderWrapper } from '../utils/NodeProviderWrapper';
import { Limits } from '../utils/limits/Limits';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { PathLimits } from '../utils/limits/PathLimits';
import { NoLimits } from '../utils/limits';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';

interface ResolutionContext {
  limits: Limits;
  nodeProvider: NodeProvider;
  resolvedTypeCache: Map<string, ResolvedBlueNode>;
  pathStack: string[];
}

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
    return this.mergeWithContext(
      target,
      source,
      this.createResolutionContext(limits),
    );
  }

  private mergeWithContext(
    target: BlueNode,
    source: BlueNode,
    context: ResolutionContext,
  ): BlueNode {
    if (isNonNullable(source.getBlue())) {
      throw new Error(
        'Document contains "blue" attribute. Preprocess document before merging.',
      );
    }

    let newTarget = target;
    const typeNode = source.getType();

    if (isNonNullable(typeNode)) {
      const resolvedType = this.resolveTypeNode(typeNode, context);
      const typeOverlay = resolvedType.cloneShallow().setType(undefined);
      newTarget = this.mergeObject(newTarget, typeOverlay, context);
      const sourceWithResolvedType = source
        .cloneShallow()
        .setType(resolvedType);
      return this.mergeObject(newTarget, sourceWithResolvedType, context);
    }
    return this.mergeObject(newTarget, source, context);
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
    context: ResolutionContext,
  ): BlueNode {
    const workingTarget = target.cloneShallow();
    let newTarget = this.mergingProcessor.process(
      workingTarget,
      source,
      context.nodeProvider,
    );

    const children = source.getItems();
    if (isNonNullable(children)) {
      newTarget = this.mergeChildren(newTarget, children, context);
    }

    const properties = source.getProperties();
    if (isNonNullable(properties)) {
      newTarget = this.mergeProperties(newTarget, properties, context);
    }

    if (isNonNullable(source.getBlueId())) {
      newTarget = newTarget.cloneShallow().setBlueId(source.getBlueId());
    }

    if (this.mergingProcessor.postProcess) {
      newTarget = this.mergingProcessor.postProcess(
        newTarget,
        source,
        context.nodeProvider,
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
    context: ResolutionContext,
  ): BlueNode {
    const targetChildren = target.getItems();
    if (isNullable(targetChildren)) {
      const filteredChildren: BlueNode[] = [];
      for (let i = 0; i < sourceChildren.length; i++) {
        const child = sourceChildren[i];
        if (!context.limits.shouldMergePathSegment(String(i), child)) {
          continue;
        }

        this.enterPathSegment(context, String(i), child);
        try {
          const resolvedChild = child.isResolved()
            ? child
            : this.resolveWithContext(child, context);
          filteredChildren.push(resolvedChild);
        } finally {
          this.exitPathSegment(context);
        }
      }
      return target.cloneShallow().setItems(filteredChildren);
    } else if (sourceChildren.length < targetChildren.length) {
      throw new Error(
        `Subtype of element must not have more items (${targetChildren.length}) than the element itself (${sourceChildren.length}).`,
      );
    }

    const newTargetChildren = [...targetChildren];
    for (let i = 0; i < sourceChildren.length; i++) {
      if (
        !context.limits.shouldMergePathSegment(String(i), sourceChildren[i])
      ) {
        continue;
      }
      this.enterPathSegment(context, String(i), sourceChildren[i]);
      try {
        if (i >= newTargetChildren.length) {
          newTargetChildren.push(sourceChildren[i]);
          continue;
        }
        const sourceBlueId = BlueIdCalculator.calculateBlueIdSync(
          sourceChildren[i],
        );
        const targetBlueId = BlueIdCalculator.calculateBlueIdSync(
          newTargetChildren[i],
        );
        if (sourceBlueId !== targetBlueId) {
          throw new Error(
            `Mismatched items at index ${i}: source item has blueId '${sourceBlueId}', but target item has blueId '${targetBlueId}'.`,
          );
        }
      } finally {
        this.exitPathSegment(context);
      }
    }
    return target.cloneShallow().setItems(newTargetChildren);
  }

  /**
   * Merges source properties into target using copy-on-write for properties map
   * @param target - The target node
   * @param sourceProperties - The properties to merge from source
   * @param limits - The limits to apply
   * @returns A new BlueNode with merged properties
   */
  private mergeProperties(
    target: BlueNode,
    sourceProperties: Record<string, BlueNode>,
    context: ResolutionContext,
  ): BlueNode {
    const baseProperties = target.getProperties() ?? {};
    let mergedProperties = baseProperties;
    let hasChanges = false;

    for (const [key, value] of Object.entries(sourceProperties)) {
      if (!context.limits.shouldMergePathSegment(key, value)) {
        continue;
      }

      this.enterPathSegment(context, key, value);
      try {
        const resolvedValue = value.isResolved()
          ? (value as ResolvedBlueNode)
          : this.resolveWithContext(value, context);
        const existingValue = mergedProperties[key];
        const nextValue =
          existingValue === undefined
            ? resolvedValue
            : this.mergeObject(existingValue, resolvedValue, context);

        if (nextValue !== existingValue) {
          if (!hasChanges) {
            mergedProperties = { ...baseProperties };
            hasChanges = true;
          }
          mergedProperties[key] = nextValue;
        }
      } finally {
        this.exitPathSegment(context);
      }
    }

    if (!hasChanges) {
      return target;
    }

    return target.cloneShallow().setProperties(mergedProperties);
  }

  /**
   * Resolves a node by creating a new node and merging the source into it
   * @param node - The node to resolve
   * @param limits - The limits to apply during resolution
   * @returns A ResolvedBlueNode containing the resolved content
   */
  public resolve(node: BlueNode, limits: Limits): ResolvedBlueNode {
    return this.resolveWithContext(node, this.createResolutionContext(limits));
  }

  private resolveWithContext(
    node: BlueNode,
    context: ResolutionContext,
  ): ResolvedBlueNode {
    const resultNode = new BlueNode();
    const mergedNode = this.mergeWithContext(resultNode, node, context);
    const finalNode = mergedNode
      .clone()
      .setName(node.getName())
      .setDescription(node.getDescription())
      .setBlueId(node.getBlueId());

    return new ResolvedBlueNode(finalNode);
  }

  private createResolutionContext(limits: Limits): ResolutionContext {
    return {
      limits,
      nodeProvider: this.nodeProvider,
      resolvedTypeCache: new Map<string, ResolvedBlueNode>(),
      pathStack: [],
    };
  }

  private resolveTypeNode(
    typeNode: BlueNode,
    context: ResolutionContext,
  ): ResolvedBlueNode {
    const typeBlueId = typeNode.getBlueId();
    if (isNonNullable(typeBlueId)) {
      const cacheKey = this.createResolvedTypeCacheKey(typeBlueId, context);
      const cachedType = context.resolvedTypeCache.get(cacheKey);
      if (isNonNullable(cachedType)) {
        return cachedType;
      }

      const resolvedType = this.resolveAndExtendTypeNode(typeNode, context);
      context.resolvedTypeCache.set(cacheKey, resolvedType);
      return resolvedType;
    }

    return this.resolveAndExtendTypeNode(typeNode, context);
  }

  private resolveAndExtendTypeNode(
    typeNode: BlueNode,
    context: ResolutionContext,
  ): ResolvedBlueNode {
    const clonedTypeNode = typeNode.clone();
    if (isNonNullable(clonedTypeNode.getBlueId())) {
      new NodeExtender(context.nodeProvider).extend(
        clonedTypeNode,
        PathLimits.withSinglePath('/'),
      );
    }

    return this.resolveWithContext(clonedTypeNode, context);
  }

  private createResolvedTypeCacheKey(
    typeBlueId: string,
    context: ResolutionContext,
  ): string {
    if (context.limits instanceof NoLimits) {
      return typeBlueId;
    }

    return `${typeBlueId}|${this.getCurrentPointer(context)}`;
  }

  private getCurrentPointer(context: ResolutionContext): string {
    if (context.pathStack.length === 0) {
      return '/';
    }

    return `/${context.pathStack.join('/')}`;
  }

  private enterPathSegment(
    context: ResolutionContext,
    pathSegment: string,
    currentNode?: BlueNode,
  ): void {
    context.pathStack.push(pathSegment);
    context.limits.enterPathSegment(pathSegment, currentNode);
  }

  private exitPathSegment(context: ResolutionContext): void {
    context.pathStack.pop();
    context.limits.exitPathSegment();
  }
}
