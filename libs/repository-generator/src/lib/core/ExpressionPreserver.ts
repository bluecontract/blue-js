import { BlueNode, type MergingProcessor } from '@blue-labs/language';

const EXPRESSION_PATTERN = /^\$\{([\s\S]*)\}$/;

export class ExpressionPreserver implements MergingProcessor {
  process(target: BlueNode, source: BlueNode): BlueNode {
    const sourceValue = source.getValue();

    if (isExpression(sourceValue)) {
      const expressionNode = source.clone();
      expressionNode.setValue(sourceValue);
      expressionNode.setProperties(undefined);
      expressionNode.setItems(undefined);
      expressionNode.setType(undefined);
      return expressionNode;
    }

    return target;
  }

  postProcess(target: BlueNode, source: BlueNode): BlueNode {
    const sourceValue = source.getValue();

    if (isExpression(sourceValue) && target.getValue() !== sourceValue) {
      const fixed = target.clone();
      fixed.setValue(sourceValue);
      return fixed;
    }

    return target;
  }
}

function isExpression(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (!EXPRESSION_PATTERN.test(value)) {
    return false;
  }
  return value.indexOf('${') === value.lastIndexOf('${');
}
