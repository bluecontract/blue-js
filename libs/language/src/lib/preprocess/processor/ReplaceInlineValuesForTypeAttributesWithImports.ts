import { BlueNode } from '../../model';
import { TransformationProcessor } from '../interfaces';
import { NodeTransformer } from '../../utils/NodeTransformer';

/**
 * Processor that replaces inline values for type attributes with imports
 */
export class ReplaceInlineValuesForTypeAttributesWithImports
  implements TransformationProcessor
{
  public static readonly MAPPINGS = 'mappings';
  private mappings: Map<string, string> = new Map();

  /**
   * Creates a new processor with the given transformation node or mappings
   * @param transformationOrMappings - The transformation node or mappings to use
   */
  constructor(transformationOrMappings: BlueNode | Map<string, string>) {
    if (transformationOrMappings instanceof BlueNode) {
      const transformation = transformationOrMappings;
      const properties = transformation.getProperties();

      if (
        properties &&
        properties[ReplaceInlineValuesForTypeAttributesWithImports.MAPPINGS]
      ) {
        const mappingsNode =
          properties[ReplaceInlineValuesForTypeAttributesWithImports.MAPPINGS];
        const mappingProperties = mappingsNode.getProperties();

        if (mappingProperties) {
          Object.entries(mappingProperties).forEach(([key, node]) => {
            const value = node.getValue();
            if (typeof value === 'string') {
              this.mappings.set(key, value);
            }
          });
        }
      }
    } else {
      this.mappings = transformationOrMappings;
    }
  }

  /**
   * Process a document node to replace inline values for type attributes with imports
   * @param document - The document to process
   * @returns The processed document
   */
  process(document: BlueNode): BlueNode {
    return NodeTransformer.transform(document, this.transformNode.bind(this));
  }

  private transformNode(node: BlueNode): BlueNode {
    const transformedNode = node.clone();
    this.transformTypeField(transformedNode, transformedNode.getType());
    this.transformTypeField(transformedNode, transformedNode.getItemType());
    this.transformTypeField(transformedNode, transformedNode.getKeyType());
    this.transformTypeField(transformedNode, transformedNode.getValueType());
    return transformedNode;
  }

  private transformTypeField(
    node: BlueNode,
    typeNode: BlueNode | undefined,
  ): void {
    if (
      typeNode &&
      typeNode.isInlineValue() &&
      typeNode.getValue() !== undefined
    ) {
      const typeValue = String(typeNode.getValue());

      if (this.mappings.has(typeValue)) {
        const blueId = this.mappings.get(typeValue);
        if (blueId) {
          const newTypeNode = new BlueNode().setBlueId(blueId);

          if (typeNode === node.getType()) {
            node.setType(newTypeNode);
          } else if (typeNode === node.getItemType()) {
            node.setItemType(newTypeNode);
          } else if (typeNode === node.getKeyType()) {
            node.setKeyType(newTypeNode);
          } else if (typeNode === node.getValueType()) {
            node.setValueType(newTypeNode);
          }
        }
      }
    }
  }
}
