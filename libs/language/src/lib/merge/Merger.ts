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
import { NO_LIMITS, NoLimits } from '../utils/limits';
import { attachSubtypeCache } from '../utils/NodeTypes';
import { ListControls } from '../utils/ListControls';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';

interface ResolutionContext {
  limits: Limits;
  nodeProvider: NodeProvider;
  resolvedTypeCache: Map<string, ResolvedBlueNode>;
  typeOverlayCache: Map<string, BlueNode>;
  nodeHashCache: WeakMap<BlueNode, string>;
  providerFetchCache: Map<string, BlueNode[] | null>;
  subtypeCache: Map<string, boolean>;
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
      const typeOverlay = this.getTypeOverlay(typeNode, resolvedType, context);
      newTarget = this.mergeObject(newTarget, typeOverlay, context);
      const sourceWithResolvedType = source
        .cloneShallow()
        .setType(resolvedType.clone());
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
      newTarget = this.mergeChildren(newTarget, source, context);
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
    source: BlueNode,
    context: ResolutionContext,
  ): BlueNode {
    const sourceChildren = source.getItems() ?? [];
    if (ListControls.hasListControlItems(sourceChildren)) {
      return this.mergeChildrenWithListControls(target, source, context);
    }

    return this.mergeChildrenWithoutListControls(
      target,
      sourceChildren,
      context,
    );
  }

  private mergeChildrenWithoutListControls(
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
          const resolvedChild = this.materializeForCurrentContext(
            child,
            context,
          );
          filteredChildren.push(resolvedChild);
        } finally {
          this.exitPathSegment(context);
        }
      }
      return target.cloneShallow().setItems(filteredChildren);
    }

    if (sourceChildren.length < targetChildren.length) {
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
          const resolvedAppendedChild = this.materializeForCurrentContext(
            sourceChildren[i],
            context,
          );
          newTargetChildren.push(resolvedAppendedChild);
          continue;
        }
        const sourceBlueId = this.calculateNodeBlueId(
          sourceChildren[i],
          context,
        );
        const targetBlueId = this.calculateNodeBlueId(
          newTargetChildren[i],
          context,
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

  private mergeChildrenWithListControls(
    target: BlueNode,
    source: BlueNode,
    context: ResolutionContext,
  ): BlueNode {
    const sourceChildren = source.getItems() ?? [];
    const targetChildren = target.getItems() ?? [];
    const mergePolicy = ListControls.getMergePolicy(source, target);
    const newTargetChildren = [...targetChildren];
    let sourceIndex = 0;
    let hasPreviousAnchor = false;

    const firstSourceChild = sourceChildren[0];
    if (
      firstSourceChild !== undefined &&
      ListControls.hasPreviousProperty(firstSourceChild)
    ) {
      const previousBlueId = ListControls.getPreviousBlueId(firstSourceChild);
      if (previousBlueId === undefined) {
        throw new Error(
          '$previous list control must be exactly { $previous: { blueId: <id> } }.',
        );
      }

      if (context.limits instanceof NoLimits) {
        const targetListBlueId =
          BlueIdCalculator.calculateBlueIdSync(targetChildren);
        if (targetListBlueId !== previousBlueId) {
          throw new Error(
            `$previous list control points to '${previousBlueId}', but inherited list has blueId '${targetListBlueId}'.`,
          );
        }
      }
      hasPreviousAnchor = true;
      sourceIndex = 1;
    }

    const inheritedPrefixUnavailable =
      hasPreviousAnchor &&
      targetChildren.length === 0 &&
      !(context.limits instanceof NoLimits);

    const positionedIndexes = new Set<number>();
    for (; sourceIndex < sourceChildren.length; sourceIndex++) {
      const sourceChild = sourceChildren[sourceIndex];
      if (ListControls.hasPreviousProperty(sourceChild)) {
        throw new Error(
          '$previous list control is allowed only as the first item.',
        );
      }

      const position = ListControls.readPosition(sourceChild);
      if (position !== undefined) {
        if (mergePolicy === 'append-only') {
          throw new Error('$pos is not allowed in append-only lists.');
        }

        if (position >= targetChildren.length) {
          throw new Error(
            `$pos ${position} is out of range for inherited list length ${targetChildren.length}.`,
          );
        }

        if (positionedIndexes.has(position)) {
          throw new Error(`Duplicate $pos list overlay for index ${position}.`);
        }
        positionedIndexes.add(position);

        const payload = ListControls.withoutPosition(sourceChild);
        if (!ListControls.hasPayloadAfterRemovingPosition(sourceChild)) {
          throw new Error('$pos list control must include an item payload.');
        }

        if (!context.limits.shouldMergePathSegment(String(position), payload)) {
          continue;
        }

        this.enterPathSegment(context, String(position), payload);
        try {
          const existingChild = newTargetChildren[position];
          newTargetChildren[position] =
            existingChild === undefined ||
            ListControls.isReplacementPayload(payload)
              ? this.materializeForCurrentContext(payload, context)
              : this.mergeWithContext(existingChild, payload, context);
        } finally {
          this.exitPathSegment(context);
        }
        continue;
      }

      const appendIndex = newTargetChildren.length;
      if (
        !inheritedPrefixUnavailable &&
        !context.limits.shouldMergePathSegment(String(appendIndex), sourceChild)
      ) {
        continue;
      }

      if (inheritedPrefixUnavailable) {
        newTargetChildren.push(
          this.materializeWithoutLimits(sourceChild, context),
        );
        continue;
      }

      this.enterPathSegment(context, String(appendIndex), sourceChild);
      try {
        const resolvedAppendedChild = this.materializeForCurrentContext(
          sourceChild,
          context,
        );
        newTargetChildren.push(resolvedAppendedChild);
      } finally {
        this.exitPathSegment(context);
      }
    }

    return target.cloneShallow().setItems(newTargetChildren);
  }

  private materializeWithoutLimits(
    node: BlueNode,
    context: ResolutionContext,
  ): BlueNode {
    return new Merger(this.mergingProcessor, context.nodeProvider).resolve(
      node,
      NO_LIMITS,
    );
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
        const existingValue = mergedProperties[key];
        const shouldMergeUnresolvedValue =
          this.shouldMergePropertyWithoutPreResolve(
            existingValue,
            value,
            context,
          );

        const nextValue = shouldMergeUnresolvedValue
          ? this.mergeWithContext(existingValue, value, context)
          : (() => {
              const resolvedValue = this.materializeForCurrentContext(
                value,
                context,
              );
              return existingValue === undefined
                ? resolvedValue
                : this.mergeObject(existingValue, resolvedValue, context);
            })();

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
   * Under path-limited resolution, pre-resolving list-like source properties
   * compacts indexes and may overwrite inherited-prefix metadata for the current
   * pointer. Merge unresolved source to preserve index semantics, but still
   * through mergeWithContext so source type overlays are resolved.
   */
  private shouldMergePropertyWithoutPreResolve(
    existingValue: BlueNode | undefined,
    sourceValue: BlueNode,
    context: ResolutionContext,
  ): boolean {
    if (isNullable(existingValue) || context.limits instanceof NoLimits) {
      return (
        isNonNullable(existingValue) &&
        ListControls.hasListControlItems(sourceValue.getItems())
      );
    }

    return (
      isNonNullable(sourceValue.getItems()) ||
      isNonNullable(existingValue.getItems())
    );
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
      .cloneShallow()
      .setName(node.getName())
      .setDescription(node.getDescription())
      .setBlueId(node.getBlueId());

    return new ResolvedBlueNode(finalNode, {
      completeness:
        context.limits instanceof NoLimits ? 'full' : 'path-limited',
    });
  }

  private createResolutionContext(limits: Limits): ResolutionContext {
    const providerFetchCache = new Map<string, BlueNode[] | null>();
    const subtypeCache = new Map<string, boolean>();
    const cachedProvider = attachSubtypeCache(
      this.createResolutionNodeProvider(this.nodeProvider, providerFetchCache),
      subtypeCache,
    );

    return {
      limits,
      nodeProvider: cachedProvider,
      resolvedTypeCache: new Map<string, ResolvedBlueNode>(),
      typeOverlayCache: new Map<string, BlueNode>(),
      nodeHashCache: new WeakMap<BlueNode, string>(),
      providerFetchCache,
      subtypeCache,
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
      resolvedType.setReferenceBlueId(typeBlueId);
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

  private getTypeOverlay(
    typeNode: BlueNode,
    resolvedType: ResolvedBlueNode,
    context: ResolutionContext,
  ): BlueNode {
    const typeBlueId = typeNode.getBlueId();
    if (isNullable(typeBlueId)) {
      return this.createTypeOverlay(resolvedType);
    }

    const cacheKey = this.createResolvedTypeCacheKey(typeBlueId, context);
    const cachedOverlay = context.typeOverlayCache.get(cacheKey);
    if (isNonNullable(cachedOverlay)) {
      return cachedOverlay;
    }

    const typeOverlay = this.createTypeOverlay(resolvedType);
    context.typeOverlayCache.set(cacheKey, typeOverlay);
    return typeOverlay;
  }

  private createTypeOverlay(resolvedType: ResolvedBlueNode): BlueNode {
    return resolvedType.cloneShallow().setType(undefined).setBlueId(undefined);
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

  private materializeForCurrentContext(
    node: BlueNode,
    context: ResolutionContext,
  ): BlueNode {
    return node.isResolved() && this.canReuseResolvedSubtree(context)
      ? node.clone()
      : this.resolveWithContext(node, context);
  }

  private canReuseResolvedSubtree(context: ResolutionContext): boolean {
    return context.limits instanceof NoLimits;
  }

  private calculateNodeBlueId(
    node: BlueNode,
    context: ResolutionContext,
  ): string {
    const cachedBlueId = context.nodeHashCache.get(node);
    if (isNonNullable(cachedBlueId)) {
      return cachedBlueId;
    }

    const blueId = BlueIdCalculator.calculateBlueIdSync(node);
    context.nodeHashCache.set(node, blueId);
    return blueId;
  }

  private createResolutionNodeProvider(
    nodeProvider: NodeProvider,
    cache: Map<string, BlueNode[] | null>,
  ): NodeProvider {
    return new (class extends NodeProvider {
      override fetchByBlueId(blueId: string): BlueNode[] | null {
        if (cache.has(blueId)) {
          return cache.get(blueId) ?? null;
        }

        const nodes = nodeProvider.fetchByBlueId(blueId);
        cache.set(blueId, nodes);
        return nodes;
      }
    })();
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
