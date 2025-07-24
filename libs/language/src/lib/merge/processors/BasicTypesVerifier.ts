import { BlueNode } from '../../model';
import { NodeProvider } from '../../NodeProvider';
import { MergingProcessor } from '../MergingProcessor';
import { NodeTypes } from '../../utils';

/**
 * Verifies that nodes with basic types don't have items or properties
 */
export class BasicTypesVerifier implements MergingProcessor {
  process(target: BlueNode): BlueNode {
    return target;
  }

  postProcess(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider
  ): BlueNode {
    const targetType = target.getType();
    if (
      targetType !== undefined &&
      NodeTypes.isSubtypeOfBasicType(targetType, nodeProvider)
    ) {
      const items = target.getItems();
      const properties = target.getProperties();

      if (
        (items !== undefined && items.length > 0) ||
        (properties !== undefined && Object.keys(properties).length > 0)
      ) {
        const basicTypeName = NodeTypes.findBasicTypeName(
          targetType,
          nodeProvider
        );
        const typeName = targetType.getName() || 'unknown';
        throw new Error(
          `Node of type "${typeName}" (which extends basic type "${basicTypeName}") must not have items, properties or contracts.`
        );
      }
    }
    return target;
  }
}
