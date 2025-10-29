import { BlueNode } from '../../model';
import { TransformationProcessor } from '../interfaces';
import { NodeTransformer } from '../../utils/NodeTransformer';

/**
 * Processor that validates all inline type values have been replaced with BlueIds
 */
export class ValidateInlineTypesReplaced implements TransformationProcessor {
  /**
   * Process a document node to validate all inline types have been replaced
   * @param document - The document to process
   * @returns The document unchanged if validation passes
   * @throws Error if any inline type values remain without BlueId mappings
   */
  process(document: BlueNode): BlueNode {
    NodeTransformer.transform(document, this.validateNode.bind(this));
    return document;
  }

  private validateNode(node: BlueNode): BlueNode {
    this.validateTypeField(node, node.getType(), 'type');
    this.validateTypeField(node, node.getItemType(), 'itemType');
    this.validateTypeField(node, node.getKeyType(), 'keyType');
    this.validateTypeField(node, node.getValueType(), 'valueType');
    return node;
  }

  private validateTypeField(
    node: BlueNode,
    typeNode: BlueNode | undefined,
    fieldName: string,
  ): void {
    if (
      typeNode &&
      typeNode.isInlineValue() &&
      typeNode.getValue() !== undefined
    ) {
      const typeValue = String(typeNode.getValue());
      throw new Error(
        `Unknown type "${typeValue}" found in ${fieldName} field. No BlueId mapping exists for this type.`,
      );
    }
  }
}
