import { BlueNode } from '../../model';
import { NodeProvider } from '../../NodeProvider';
import { MergingProcessor } from '../MergingProcessor';
import { isSubtypeOfBasicType, findBasicTypeName } from './Types';

/**
 * Verifies that nodes with basic types don't have items or properties
 */
export class BasicTypesVerifier implements MergingProcessor {
  process(): void {
    // Do nothing during process phase
  }

  postProcess(
    target: BlueNode,
    source: BlueNode,
    nodeProvider: NodeProvider
  ): void {
    const targetType = target.getType();
    if (
      targetType !== undefined &&
      isSubtypeOfBasicType(targetType, nodeProvider)
    ) {
      const items = target.getItems();
      const properties = target.getProperties();
      const contracts = target.getContracts();

      if (
        (items !== undefined && items.length > 0) ||
        (properties !== undefined && Object.keys(properties).length > 0) ||
        (contracts !== undefined && Object.keys(contracts).length > 0)
      ) {
        const basicTypeName = findBasicTypeName(targetType, nodeProvider);
        const typeName = targetType.getName() || 'unknown';
        throw new Error(
          `Node of type "${typeName}" (which extends basic type "${basicTypeName}") must not have items, properties or contracts.`
        );
      }
    }
  }
}
