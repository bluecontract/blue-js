import { BlueNode } from '../../model';
import { NodeProvider } from '../../NodeProvider';
import { MergingProcessor } from '../MergingProcessor';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import { NodeTypes } from '../../utils';

/**
 * Assigns types from source to target nodes with subtype validation
 */
export class TypeAssigner implements MergingProcessor {
  process(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider,
  ): BlueNode {
    const targetType = target.getType();
    const sourceType = source.getType();
    let newTarget = target;

    if (targetType === undefined) {
      if (
        sourceType !== undefined &&
        source.getValue() !== undefined &&
        NodeTypes.isAnonymousCoreAlias(sourceType)
      ) {
        const sourceTypeStr = NodeToMapListOrValue.get(sourceType);
        throw new Error(
          `Anonymous core type alias '${JSON.stringify(
            sourceTypeStr,
          )}' is not interchangeable with its registry core type.`,
        );
      }
      newTarget = target.cloneShallow().setType(sourceType);
    } else if (sourceType !== undefined) {
      const isSubtypeResult = NodeTypes.isSubtype(
        sourceType,
        targetType,
        nodeProvider,
      );
      if (!isSubtypeResult) {
        const sourceTypeStr = NodeToMapListOrValue.get(sourceType);
        const targetTypeStr = NodeToMapListOrValue.get(targetType);
        throw new Error(
          `The source type '${JSON.stringify(
            sourceTypeStr,
          )}' is not a subtype of the target type '${JSON.stringify(
            targetTypeStr,
          )}'.`,
        );
      }
      newTarget = target.cloneShallow().setType(sourceType);
    }
    return newTarget;
  }
}
