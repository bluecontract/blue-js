import { BlueNode } from '../../model';
import { PathLimits, PathLimitsBuilder } from './PathLimits';

export class NodeToPathLimitsConverter {
  public static convert(node: BlueNode): PathLimits {
    const builder = new PathLimitsBuilder();
    NodeToPathLimitsConverter.traverseNode(node, '', builder);
    return builder.build();
  }

  private static traverseNode(
    node: BlueNode | undefined,
    currentPath: string,
    builder: PathLimitsBuilder,
  ): void {
    if (!node) {
      return;
    }

    const props = node.getProperties();
    const items = node.getItems();

    const hasProps = props !== undefined && Object.keys(props).length > 0;
    const hasItems = items !== undefined && items.length > 0;

    if (!hasProps && !hasItems) {
      builder.addPath(currentPath === '' ? '/' : currentPath);
      return;
    }

    if (props) {
      for (const [key, value] of Object.entries(props)) {
        const newPath = `${currentPath}/${key}`;
        NodeToPathLimitsConverter.traverseNode(value, newPath, builder);
      }
    }

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const newPath = `${currentPath}/${i}`;
        NodeToPathLimitsConverter.traverseNode(items[i], newPath, builder);
      }
    }
  }
}
