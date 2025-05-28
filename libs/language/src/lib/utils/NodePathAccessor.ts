import { BlueNode } from '../model';
import { isNonNullable, isNullable } from '@blue-company/shared-utils';

export class NodePathAccessor {
  static get(
    node: BlueNode,
    path: string,
    linkingProvider?: (node: BlueNode) => BlueNode | null,
    resolveFinalLink = true
  ) {
    if (isNullable(path) || !path.startsWith('/')) {
      throw new Error(`Invalid path: ${path}`);
    }

    if (path === '/') {
      const value = node.getValue();
      return isNonNullable(value) ? value : node;
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
  ): BlueNode | NonNullable<BlueNode['value']> | undefined {
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
      return isNonNullable(value) ? value : node;
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
  ) {
    switch (segment) {
      case 'name': {
        const name = node.getName();
        return isNonNullable(name)
          ? new BlueNode().setValue(name)
          : new BlueNode();
      }
      case 'description': {
        const description = node.getDescription();
        return isNonNullable(description)
          ? new BlueNode().setValue(description)
          : new BlueNode();
      }
      case 'type':
        return node.getType() ?? new BlueNode();
      case 'itemType':
        return node.getItemType() ?? new BlueNode();
      case 'keyType':
        return node.getKeyType() ?? new BlueNode();
      case 'valueType':
        return node.getValueType() ?? new BlueNode();
      case 'value': {
        const value = node.getValue();
        return isNonNullable(value)
          ? new BlueNode().setValue(value)
          : new BlueNode();
      }
      case 'blueId': {
        const blueId = node.getBlueId();
        return isNonNullable(blueId)
          ? new BlueNode().setValue(blueId)
          : new BlueNode();
      }
    }

    let result: BlueNode;

    if (/^\d+$/.test(segment)) {
      const itemIndex = parseInt(segment, 10);
      const items = node.getItems();
      if (!items || itemIndex >= items.length) {
        return undefined;
      }
      result = items[itemIndex];
    } else {
      const properties = node.getProperties();
      if (!properties || !(segment in properties)) {
        return undefined;
      }
      result = properties[segment];
    }

    return resolveLink && linkingProvider
      ? this.link(result, linkingProvider)
      : result;
  }

  private static link(
    node: BlueNode,
    linkingProvider: (node: BlueNode) => BlueNode | null
  ) {
    const linked = linkingProvider(node);
    return isNonNullable(linked) ? linked : node;
  }
}
