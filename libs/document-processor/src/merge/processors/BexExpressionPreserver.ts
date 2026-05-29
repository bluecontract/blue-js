import { BlueNode, MergingProcessor } from '@blue-labs/language';

/**
 * Keeps BEX expression objects as runtime expressions while Blue resolves
 * surrounding typed contracts.
 */
export class BexExpressionPreserver implements MergingProcessor {
  preserveSource(_target: BlueNode, source: BlueNode): BlueNode | undefined {
    if (isBexExpressionNode(source)) {
      return stripMergeMetadata(source.clone());
    }

    return undefined;
  }

  process(target: BlueNode, source: BlueNode): BlueNode {
    if (isBexExpressionNode(source)) {
      return stripMergeMetadata(source.clone());
    }

    return target;
  }

  shouldPreserveSource(source: BlueNode): boolean {
    return isBexExpressionNode(source);
  }

  postProcess(target: BlueNode, source: BlueNode): BlueNode {
    if (isBexExpressionNode(source)) {
      return stripMergeMetadata(target.clone());
    }

    return target;
  }
}

function isBexExpressionNode(node: BlueNode): boolean {
  const properties = node.getProperties();
  if (!properties) {
    return false;
  }
  const keys = Object.keys(properties);
  return keys.length === 1 && keys[0].startsWith('$');
}

function stripMergeMetadata(node: BlueNode): BlueNode {
  return node.setType(undefined);
}
