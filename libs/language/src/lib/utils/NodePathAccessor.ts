import { BlueNode } from '../model';
import { BlueIdCalculator } from './BlueIdCalculator';

export class NodePathAccessor {
  static async get(
    node: BlueNode,
    path: string,
    linkingProvider?: (node: BlueNode) => BlueNode | null,
    resolveFinalLink = true
  ) {
    if (!path || !path.startsWith('/')) {
      throw new Error(`Invalid path: ${path}`);
    }

    if (path === '/') {
      const value = node.getValue();
      return value || node;
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

  private static async getRecursive(
    node: BlueNode,
    segments: string[],
    index: number,
    linkingProvider?: (node: BlueNode) => BlueNode | null,
    resolveFinalLink?: boolean
  ): Promise<BlueNode | NonNullable<BlueNode['value']>> {
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
      return value || node;
    }

    const segment = segments[index];
    const nextNode = await this.getNodeForSegment(
      node,
      segment,
      linkingProvider,
      true
    );
    return this.getRecursive(
      nextNode,
      segments,
      index + 1,
      linkingProvider,
      resolveFinalLink
    );
  }

  private static async getNodeForSegment(
    node: BlueNode,
    segment: string,
    linkingProvider?: (node: BlueNode) => BlueNode | null,
    resolveLink?: boolean
  ) {
    switch (segment) {
      case 'name': {
        const name = node.getName();
        return name ? new BlueNode().setValue(name) : new BlueNode();
      }
      case 'description': {
        const description = node.getDescription();
        return description
          ? new BlueNode().setValue(description)
          : new BlueNode();
      }
      case 'type':
        return node.getType() ?? new BlueNode();
      case 'value': {
        const value = node.getValue();
        return value ? new BlueNode().setValue(value) : new BlueNode();
      }
      case 'blueId':
        return new BlueNode().setValue(
          await BlueIdCalculator.calculateBlueId(node)
        );
    }

    let result: BlueNode;

    if (/^\d+$/.test(segment)) {
      const itemIndex = parseInt(segment, 10);
      const items = node.getItems();
      if (!items || itemIndex >= items.length) {
        throw new Error(`Invalid item index: ${itemIndex}`);
      }
      result = items[itemIndex];
    } else {
      const properties = node.getProperties();
      if (!properties || !(segment in properties)) {
        throw new Error(`Property not found: ${segment}`);
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
    return linked || node;
  }
}
