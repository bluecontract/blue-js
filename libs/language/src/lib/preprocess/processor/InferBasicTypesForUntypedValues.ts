import { BlueNode } from '../../model';
import { TransformationProcessor } from '../interfaces';
import { NodeTransformer } from '../../utils/NodeTransformer';
import {
  TEXT_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  BOOLEAN_TYPE_BLUE_ID,
} from '../../utils/Properties';
import { isNonNullable, isNullable } from '@blue-labs/shared-utils';
import {
  isBigDecimalNumber,
  isBigIntegerNumber,
} from '../../../utils/typeGuards';

/**
 * Processor that infers basic types for untyped values
 */
export class InferBasicTypesForUntypedValues implements TransformationProcessor {
  /**
   * Process a document node to infer basic types for untyped values
   * @param document - The document to process
   * @returns The processed document
   */
  process(document: BlueNode): BlueNode {
    return NodeTransformer.transform(document, this.inferType.bind(this));
  }

  /**
   * Infer a basic type for a node
   * @param node - The node to infer a type for
   * @returns The node with the inferred type
   */
  private inferType(node: BlueNode): BlueNode {
    const type = node.getType();
    const value = node.getValue();

    if (isNullable(type) && isNonNullable(value)) {
      if (typeof value === 'string') {
        node.setType(new BlueNode().setBlueId(TEXT_TYPE_BLUE_ID));
      } else if (typeof value === 'bigint' || isBigIntegerNumber(value)) {
        node.setType(new BlueNode().setBlueId(INTEGER_TYPE_BLUE_ID));
      } else if (isBigDecimalNumber(value)) {
        node.setType(new BlueNode().setBlueId(DOUBLE_TYPE_BLUE_ID));
      } else if (typeof value === 'boolean') {
        node.setType(new BlueNode().setBlueId(BOOLEAN_TYPE_BLUE_ID));
      }
    }

    return node;
  }
}
