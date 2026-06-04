import { BlueNode, MergingProcessor } from '@blue-labs/language';

import { isBexExpressionNode } from '../../util/bex-expression-node.js';

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

function stripMergeMetadata(node: BlueNode): BlueNode {
  return node.setType(undefined);
}
