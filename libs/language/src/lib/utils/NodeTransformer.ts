import { BlueNode } from '../model';

/**
 * Utility class for transforming BlueNodes
 */
export class NodeTransformer {
  /**
   * Transforms a node and all its child nodes using the provided transformer function
   * @param node - The node to transform
   * @param transformer - The transformer function to apply to each node
   * @returns The transformed node
   */
  static transform(
    node: BlueNode,
    transformer: (node: BlueNode) => BlueNode
  ): BlueNode {
    // First apply the transformer to this node
    const transformedNode = transformer(node.clone());

    const type = transformedNode.getType();
    if (type !== undefined) {
      transformedNode.setType(NodeTransformer.transform(type, transformer));
    }

    const itemType = transformedNode.getItemType();
    if (itemType !== undefined) {
      transformedNode.setItemType(
        NodeTransformer.transform(itemType, transformer)
      );
    }

    const keyType = transformedNode.getKeyType();
    if (keyType !== undefined) {
      transformedNode.setKeyType(
        NodeTransformer.transform(keyType, transformer)
      );
    }

    const valueType = transformedNode.getValueType();
    if (valueType !== undefined) {
      transformedNode.setValueType(
        NodeTransformer.transform(valueType, transformer)
      );
    }

    const items = transformedNode.getItems();
    if (items !== undefined) {
      const transformedItems = items.map((item) =>
        NodeTransformer.transform(item, transformer)
      );
      transformedNode.setItems(transformedItems);
    }

    const properties = transformedNode.getProperties();
    if (properties !== undefined) {
      const transformedProperties = Object.keys(properties).reduce(
        (acc, key) => {
          acc[key] = NodeTransformer.transform(properties[key], transformer);
          return acc;
        },
        {} as Record<string, BlueNode>
      );
      transformedNode.setProperties(transformedProperties);
    }

    const contracts = transformedNode.getContracts();
    if (contracts !== undefined) {
      const transformedContracts = Object.keys(contracts).reduce((acc, key) => {
        acc[key] = NodeTransformer.transform(contracts[key], transformer);
        return acc;
      }, {} as Record<string, BlueNode>);
      transformedNode.setContracts(transformedContracts);
    }

    return transformedNode;
  }
}
