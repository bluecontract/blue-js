import { BlueError, BlueErrorCode } from '../errors/BlueError';
import { BlueNode } from '../model/Node';
import {
  OBJECT_CONTRACTS,
  OBJECT_MERGE_POLICY,
  OBJECT_SCHEMA,
} from './Properties';
import { Nodes } from './Nodes';

export class StorageShapeValidator {
  private static readonly RESERVED_PROPERTY_KEYS = new Set([
    OBJECT_SCHEMA,
    OBJECT_MERGE_POLICY,
    OBJECT_CONTRACTS,
  ]);

  private static readonly INTERNAL_PROPERTIES_KEY = 'properties';

  public static validateStorageShape(node: BlueNode): void {
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

    const childProperties = this.getChildProperties(node, path);
    const hasValue = node.getValue() !== undefined;
    const hasItems = node.getItems() !== undefined;
    const hasChildFields = Object.keys(childProperties).length > 0;

    if (hasValue && hasItems) {
      this.throwInvalidStorageShape(
        path,
        'A storage or authoring node cannot combine value and items payloads.',
      );
    }

    if (hasValue && hasChildFields) {
      this.throwInvalidStorageShape(
        path,
        'A storage or authoring node cannot combine value payload with object child fields.',
      );
    }

    if (hasItems && hasChildFields) {
      this.throwInvalidStorageShape(
        path,
        'A storage or authoring node cannot combine items payload with object child fields.',
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

  private static getChildProperties(
    node: BlueNode,
    path: string[],
  ): Record<string, BlueNode> {
    const properties = node.getProperties() ?? {};

    if (
      Object.prototype.hasOwnProperty.call(
        properties,
        this.INTERNAL_PROPERTIES_KEY,
      )
    ) {
      this.throwInvalidStorageShape(
        [...path, this.INTERNAL_PROPERTIES_KEY],
        'The document-level properties key is not part of the Blue language.',
      );
    }

    return Object.fromEntries(
      Object.entries(properties).filter(
        ([key]) => !this.RESERVED_PROPERTY_KEYS.has(key),
      ),
    );
  }

  private static throwInvalidStorageShape(
    path: string[],
    message: string,
  ): never {
    const pointer = this.toPointer(path);
    throw new BlueError(
      BlueErrorCode.INVALID_STORAGE_SHAPE,
      `${message} at ${pointer}`,
      [
        {
          code: BlueErrorCode.INVALID_STORAGE_SHAPE,
          message,
          locationPath: path,
        },
      ],
    );
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
