import { isNonNullable, isNullable } from '@blue-labs/shared-utils';
import { BlueNode } from '../../model';
import { MergingProcessor } from '../MergingProcessor';
import {
  isBigDecimalNumber,
  isBigIntegerNumber,
} from '../../../utils/typeGuards';

/**
 * Propagates values from source to target nodes and throws an error if there is a conflict
 */
export class ValuePropagator implements MergingProcessor {
  process(target: BlueNode, source: BlueNode): BlueNode {
    const sourceValue = source.getValue();

    if (isNonNullable(sourceValue)) {
      const targetValue = target.getValue();
      if (isNullable(targetValue)) {
        return target.clone().setValue(sourceValue);
      } else if (!isEqualValue(sourceValue, targetValue)) {
        throw new Error(
          `Node values conflict. Source node value: ${sourceValue}, target node value: ${targetValue}`,
        );
      }
    }
    return target;
  }
}

const isEqualValue = (a: BlueNode['value'], b: BlueNode['value']) => {
  if (
    (isBigIntegerNumber(a) && isBigIntegerNumber(b)) ||
    (isBigDecimalNumber(a) && isBigDecimalNumber(b))
  ) {
    return a.eq(b);
  }
  return a === b;
};
