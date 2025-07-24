import { BlueNode } from '../../model';
import { MergingProcessor } from '../MergingProcessor';
import { isNonNullable } from '@blue-labs/shared-utils';

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
    if (this.isExpression(sourceValue)) {
      // When source has an expression, ignore everything from target
      // and return a minimal node with just the expression
      const expressionNode = new BlueNode();
      if (sourceValue !== undefined) {
        expressionNode.setValue(sourceValue);
      }

      // Preserve name and description from source
      if (source.getName()) {
        expressionNode.setName(source.getName());
      }
      if (source.getDescription()) {
        expressionNode.setDescription(source.getDescription());
      }

      // Important: Don't copy type, properties, or items
      // This prevents type resolution from adding structure

      return expressionNode;
    }

    return target;
  }

  /**
   * Post-process to ensure expressions aren't overridden by subsequent processors
   */
  postProcess(target: BlueNode, source: BlueNode): BlueNode {
    const sourceValue = source.getValue();

    // If source had an expression, make sure it's still preserved
    if (this.isExpression(sourceValue)) {
      // If target lost the expression value, restore it
      if (target.getValue() !== sourceValue && sourceValue !== undefined) {
        const fixed = target.clone();
        fixed.setValue(sourceValue);
        // Remove any type/structure that might have been added
        fixed.setType(undefined);
        fixed.setProperties(undefined);
        fixed.setItems(undefined);
        return fixed;
      }
    }

    return target;
  }

  private isExpression(value: unknown): boolean {
    return (
      isNonNullable(value) &&
      typeof value === 'string' &&
      value.startsWith('${') &&
      value.endsWith('}')
    );
  }
}
