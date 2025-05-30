import { BlueNode } from '../model';
import { isNonNullable, isNullable } from '@blue-company/shared-utils';
import { BigIntegerNumber, BigDecimalNumber } from '../model';

export class NodePathAccessor {
  static get(
    node: BlueNode,
    path: string,
    linkingProvider?: (node: BlueNode) => BlueNode | null,
    resolveFinalLink = true
  ):
    | BlueNode
    | string
    | boolean
    | BigIntegerNumber
    | BigDecimalNumber
    | null
    | undefined {
    if (isNullable(path) || !path.startsWith('/')) {
      throw new Error(`Invalid path: ${path}`);
    }

    if (path === '/') {
      const value = node.getValue();
      return resolveFinalLink && value !== undefined ? value : node;
    }

    const segments = path.substring(1).split('/');
    return this.getRecursive(
      node,
      segments,
      0,
      linkingProvider,
      resolveFinalLink
    );
  }

  private static getRecursive(
    node: BlueNode,
    segments: string[],
    index: number,
    linkingProvider?: (node: BlueNode) => BlueNode | null,
    resolveFinalLink?: boolean
  ):
    | BlueNode
    | string
    | boolean
    | BigIntegerNumber
    | BigDecimalNumber
    | null
    | undefined {
    if (index === segments.length - 1 && !resolveFinalLink) {
      return this.getNodeForSegment(
        node,
        segments[index],
        linkingProvider,
        false
      );
    }

    if (index === segments.length) {
      const value = node.getValue();
      if (resolveFinalLink) {
        return value !== undefined ? value : node;
      } else {
        return node;
      }
    }

    const segment = segments[index];
    const nextNode = this.getNodeForSegment(
      node,
      segment,
      linkingProvider,
      true
    );
    if (!nextNode) {
      return undefined;
    }
    return this.getRecursive(
      nextNode,
      segments,
      index + 1,
      linkingProvider,
      resolveFinalLink
    );
  }

  private static getNodeForSegment(
    node: BlueNode,
    segment: string,
    linkingProvider?: (node: BlueNode) => BlueNode | null,
    resolveLink?: boolean
  ): BlueNode | undefined {
    let resultNode: BlueNode | undefined;

    // Check user-defined properties first, as they can shadow special names
    const userProperties = node.getProperties();
    if (userProperties && segment in userProperties) {
      resultNode = userProperties[segment];
    } else {
      // Not a user property, check special names or index
      switch (segment) {
        case 'name': {
          const name = node.getName();
          resultNode = isNonNullable(name)
            ? new BlueNode().setValue(name)
            : new BlueNode();
          break;
        }
        case 'description': {
          const description = node.getDescription();
          resultNode = isNonNullable(description)
            ? new BlueNode().setValue(description)
            : new BlueNode();
          break;
        }
        case 'type':
          resultNode = node.getType() ?? new BlueNode();
          break;
        case 'itemType':
          resultNode = node.getItemType() ?? new BlueNode();
          break;
        case 'keyType':
          resultNode = node.getKeyType() ?? new BlueNode();
          break;
        case 'valueType':
          resultNode = node.getValueType() ?? new BlueNode();
          break;
        case 'value': {
          const val = node.getValue();
          resultNode = new BlueNode().setValue(val ?? null);
          break;
        }
        case 'blueId': {
          const blueId = node.getBlueId();
          resultNode = isNonNullable(blueId)
            ? new BlueNode().setValue(blueId)
            : new BlueNode();
          break;
        }
        case 'blue':
          resultNode = node.getBlue(); // Returns BlueNode | undefined
          break;
        case 'items': {
          // If path is /items, refers to the direct items of the node. Wrap them in a new BlueNode.
          const directItems = node.getItems();
          resultNode = new BlueNode().setItems(directItems); // setItems handles undefined correctly
          break;
        }
        case 'properties': {
          const directProps = node.getProperties();
          resultNode = new BlueNode().setProperties(directProps);
          break;
        }
        case 'contracts': {
          const directContracts = node.getContracts();
          resultNode = new BlueNode().setContracts(directContracts);
          break;
        }
        default: {
          if (/^\d+$/.test(segment)) {
            // Numeric index for direct items of node
            const itemIndex = parseInt(segment, 10);
            const itemsArray = node.getItems();
            if (itemsArray && itemIndex >= 0 && itemIndex < itemsArray.length) {
              resultNode = itemsArray[itemIndex];
            } else {
              resultNode = undefined;
            }
          } else {
            // Not a special property, not an index, and wasn't a user property either.
            resultNode = undefined;
          }
          break;
        }
      }
    }

    if (!resultNode) {
      return undefined;
    }

    return resolveLink && linkingProvider
      ? this.link(resultNode, linkingProvider)
      : resultNode;
  }

  private static link(
    node: BlueNode,
    linkingProvider: (node: BlueNode) => BlueNode | null
  ) {
    const linked = linkingProvider(node);
    return isNonNullable(linked) ? linked : node;
  }
}
