import { BlueNode } from '../../model';
import { NodeProvider } from '../../NodeProvider';
import { MergingProcessor } from '../MergingProcessor';
import { NodeToMapListOrValue } from '../../utils/NodeToMapListOrValue';
import { isSubtype } from './Types';

/**
 * Assigns types from source to target nodes with subtype validation
 */
export class TypeAssigner implements MergingProcessor {
  process(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider
  ): BlueNode {
    const targetType = target.getType();
    const sourceType = source.getType();
    let newTarget = target;

    if (targetType === undefined) {
      newTarget = target.clone().setType(sourceType);
    } else if (sourceType !== undefined) {
      const isSubtypeResult = isSubtype(sourceType, targetType, nodeProvider);
      if (!isSubtypeResult) {
        const sourceTypeStr = NodeToMapListOrValue.get(sourceType);
        const targetTypeStr = NodeToMapListOrValue.get(targetType);
        throw new Error(
          `The source type '${JSON.stringify(
            sourceTypeStr
          )}' is not a subtype of the target type '${JSON.stringify(
            targetTypeStr
          )}'.`
        );
      }
      newTarget = target.clone().setType(sourceType);
    }
    return newTarget;
  }
}
