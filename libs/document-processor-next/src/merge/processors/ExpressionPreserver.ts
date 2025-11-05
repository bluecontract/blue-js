import { BlueNode, MergingProcessor } from '@blue-labs/language';
import { isExpression } from '../../util/expression/quickjs-expression-utils.js';

/**
 * Preserves expression values (strings starting with "${" and ending with "}")
 * preventing them from being overridden by type definitions.
 *
 * This processor must run BEFORE TypeAssigner to be effective.
 */
export class ExpressionPreserver implements MergingProcessor {
  process(target: BlueNode, source: BlueNode): BlueNode {
    const sourceValue = source.getValue();

    // Check if source value is an expression
    if (isExpression(sourceValue)) {
      // When source has an expression, ignore everything from target
      // and return a minimal node with just the expression
      const newSource = source.clone();
      newSource.setValue(sourceValue);
      newSource.setProperties(undefined);
      newSource.setItems(undefined);
      newSource.setType(undefined);

      return newSource;
    }

    return target;
  }

  /**
   * Post-process to ensure expressions aren't overridden by subsequent processors
   */
  postProcess(target: BlueNode, source: BlueNode): BlueNode {
    const sourceValue = source.getValue();

    // If source had an expression, make sure it's still preserved
    if (isExpression(sourceValue)) {
      // If target lost the expression value, restore it
      if (target.getValue() !== sourceValue && sourceValue !== undefined) {
        const fixed = target.clone();
        fixed.setValue(sourceValue);
        return fixed;
      }
    }

    return target;
  }
}
