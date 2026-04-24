import { BlueError, BlueErrorCode } from '../errors/BlueError';
import { BlueNode } from '../model/Node';
import { Nodes } from './Nodes';

export class StorageShapeValidator {
  public static validateNoMixedReferencePayload(node: BlueNode): void {
    this.validateNode(node, []);
  }

  private static validateNode(node: BlueNode, path: string[]): void {
    const referenceBlueId = node.getReferenceBlueId();
    if (referenceBlueId !== undefined && !Nodes.hasBlueIdOnly(node)) {
      const pointer = this.toPointer(path);
      throw new BlueError(
        BlueErrorCode.AMBIGUOUS_BLUE_ID_PAYLOAD,
        `Ambiguous blueId plus payload at ${pointer}. Use exact { blueId } for references or remove blueId from payload content.`,
        [
          {
            code: BlueErrorCode.AMBIGUOUS_BLUE_ID_PAYLOAD,
            message:
              'A storage or authoring node cannot combine blueId with payload.',
            locationPath: path,
            context: { blueId: referenceBlueId },
          },
        ],
      );
    }

    this.validateChild(node.getType(), [...path, 'type']);
    this.validateChild(node.getItemType(), [...path, 'itemType']);
    this.validateChild(node.getKeyType(), [...path, 'keyType']);
    this.validateChild(node.getValueType(), [...path, 'valueType']);
    this.validateChild(node.getBlue(), [...path, 'blue']);

    node.getItems()?.forEach((item, index) => {
      this.validateNode(item, [...path, 'items', String(index)]);
    });

    const properties = node.getProperties();
    if (properties !== undefined) {
      for (const [key, property] of Object.entries(properties)) {
        this.validateNode(property, [...path, key]);
      }
    }
  }

  private static validateChild(
    node: BlueNode | undefined,
    path: string[],
  ): void {
    if (node !== undefined) {
      this.validateNode(node, path);
    }
  }

  private static toPointer(path: string[]): string {
    if (path.length === 0) {
      return '/';
    }

    return `/${path
      .map((segment) => segment.replace(/~/g, '~0').replace(/\//g, '~1'))
      .join('/')}`;
  }
}
