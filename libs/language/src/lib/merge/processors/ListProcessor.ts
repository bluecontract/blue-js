import { BlueNode } from '../../model';
import { NodeProvider } from '../../NodeProvider';
import { MergingProcessor } from '../MergingProcessor';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import { NodeTypes } from '../../utils';

/**
 * Processes list nodes, handling itemType and validating items
 */
export class ListProcessor implements MergingProcessor {
  process(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
  ): BlueNode {
    let newTarget = this.processMergePolicy(target, source);
    const sourceItemType = source.getItemType();
    const sourceType = source.getType();
    if (
      sourceItemType !== undefined &&
      sourceType !== undefined &&
      !NodeTypes.isListType(sourceType, nodeProvider)
    ) {
      throw new Error('Source node with itemType must have a List type');
    }

    const targetItemType = newTarget.getItemType();

    if (targetItemType === undefined) {
      if (sourceItemType !== undefined) {
        newTarget = newTarget.cloneShallow().setItemType(sourceItemType);
      }
    } else if (sourceItemType !== undefined) {
      const isSubtypeResult = NodeTypes.isSubtype(
        sourceItemType,
        targetItemType,
        nodeProvider,
      );
      if (!isSubtypeResult) {
        const sourceItemTypeStr = NodeToMapListOrValue.get(sourceItemType);
        const targetItemTypeStr = NodeToMapListOrValue.get(targetItemType);
        throw new Error(
          `The source item type '${JSON.stringify(
            sourceItemTypeStr,
          )}' is not a subtype of the target item type '${JSON.stringify(
            targetItemTypeStr,
          )}'.`,
        );
      }
      newTarget = newTarget.cloneShallow().setItemType(sourceItemType);
    }

    // Validate items against itemType
    const targetItemTypeForValidation = newTarget.getItemType();
    const sourceItems = source.getItems();
    if (
      targetItemTypeForValidation !== undefined &&
      sourceItems !== undefined
    ) {
      for (const item of sourceItems) {
        const itemType = item.getType();
        if (
          itemType !== undefined &&
          !NodeTypes.isSubtype(
            itemType,
            targetItemTypeForValidation,
            nodeProvider,
          )
        ) {
          const itemTypeStr = NodeToMapListOrValue.get(itemType);
          const targetItemTypeStr = NodeToMapListOrValue.get(
            targetItemTypeForValidation,
          );
          throw new Error(
            `Item of type '${JSON.stringify(
              itemTypeStr,
            )}' is not a subtype of the list's item type '${JSON.stringify(
              targetItemTypeStr,
            )}'.`,
          );
        }
      }
    }
    return newTarget;
  }

  private processMergePolicy(target: BlueNode, source: BlueNode): BlueNode {
    const sourceMergePolicy = source.getMergePolicy();
    const targetMergePolicy = target.getMergePolicy();
    this.validateMergePolicy(sourceMergePolicy);
    this.validateMergePolicy(targetMergePolicy);

    if (targetMergePolicy === undefined) {
      return sourceMergePolicy === undefined
        ? target
        : target.cloneShallow().setMergePolicy(sourceMergePolicy);
    }
    if (
      sourceMergePolicy !== undefined &&
      sourceMergePolicy !== targetMergePolicy
    ) {
      throw new Error(
        `Conflicting list mergePolicy values: target is "${targetMergePolicy}" but source is "${sourceMergePolicy}".`,
      );
    }
    return target;
  }

  private validateMergePolicy(mergePolicy: string | undefined): void {
    if (
      mergePolicy !== undefined &&
      mergePolicy !== 'positional' &&
      mergePolicy !== 'append-only'
    ) {
      throw new Error(
        'mergePolicy must be either "positional" or "append-only".',
      );
    }
  }
}
