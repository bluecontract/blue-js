import { isNonNullable, isNullable } from '@blue-labs/shared-utils';
import { BlueNode } from '../../model';
import { MergingProcessor } from '../MergingProcessor';

/**
 * Propagates values from source to target nodes
 */
export class ValuePropagator implements MergingProcessor {
  process(target: BlueNode, source: BlueNode): void {
    const sourceValue = source.getValue();
    if (isNonNullable(sourceValue)) {
      const targetValue = target.getValue();
      if (isNullable(targetValue)) {
        target.setValue(sourceValue);
      } else if (sourceValue !== targetValue) {
        throw new Error(
          `Node values conflict. Source node value: ${sourceValue}, target node value: ${targetValue}`
        );
      }
    }
  }
}
