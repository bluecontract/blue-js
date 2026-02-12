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
    const sourceItemType = source.getItemType();
    const sourceType = source.getType();
    if (
      sourceItemType !== undefined &&
      sourceType !== undefined &&
      !NodeTypes.isListType(sourceType, nodeProvider)
    ) {
      throw new Error('Source node with itemType must have a List type');
    }

    const targetItemType = target.getItemType();
    let newTarget = target;

    if (targetItemType === undefined) {
      if (sourceItemType !== undefined) {
        newTarget = target.cloneShallow().setItemType(sourceItemType);
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
      newTarget = target.cloneShallow().setItemType(sourceItemType);
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
}
