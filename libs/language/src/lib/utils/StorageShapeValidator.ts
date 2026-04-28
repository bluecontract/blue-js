import { BlueError, BlueErrorCode } from '../errors/BlueError';
import { BlueNode } from '../model/Node';
import {
  OBJECT_CONTRACTS,
  OBJECT_MERGE_POLICY,
  OBJECT_SCHEMA,
} from './Properties';
import { Nodes } from './Nodes';
import {
  ListControls,
  LIST_EMPTY_KEY,
  LIST_POSITION_KEY,
} from './ListControls';

export class StorageShapeValidator {
  private static readonly RESERVED_PROPERTY_KEYS = new Set([
    OBJECT_SCHEMA,
    OBJECT_MERGE_POLICY,
    OBJECT_CONTRACTS,
  ]);

  private static readonly INTERNAL_PROPERTIES_KEY = 'properties';

  public static validateStorageShape(node: BlueNode): void {
    this.validateNode(node, [], { insideItems: false });
  }

  public static validateStorageListShape(nodes: BlueNode[]): void {
    nodes.forEach((node, index) => {
      this.validateNode(node, [String(index)], {
        insideItems: true,
        itemIndex: index,
      });
    });
  }

  public static validateListControlShape(nodes: BlueNode[]): void {
    nodes.forEach((node, index) => {
      this.validateListControlNode(node, [String(index)], index);
    });
  }

  private static validateListControlNode(
    node: BlueNode,
    path: string[],
    itemIndex?: number,
  ): void {
    if (itemIndex !== undefined) {
      this.validateListControlItem(node, path, itemIndex);
    }

    this.validateListControlChild(node.getType(), [...path, 'type']);
    this.validateListControlChild(node.getItemType(), [...path, 'itemType']);
    this.validateListControlChild(node.getKeyType(), [...path, 'keyType']);
    this.validateListControlChild(node.getValueType(), [...path, 'valueType']);
    this.validateListControlChild(node.getBlue(), [...path, 'blue']);

    node.getItems()?.forEach((item, index) => {
      this.validateListControlNode(
        item,
        [...path, 'items', String(index)],
        index,
      );
    });

    const properties = node.getProperties();
    if (properties !== undefined) {
      for (const [key, property] of Object.entries(properties)) {
        this.validateListControlNode(property, [...path, key]);
      }
    }
  }

  private static validateNode(
    node: BlueNode,
    path: string[],
    context: { insideItems: boolean; itemIndex?: number },
  ): void {
    if (context.insideItems) {
      this.validateListControlItem(node, path, context.itemIndex ?? 0);
    }

    const referenceBlueId = node.getReferenceBlueId();
    if (referenceBlueId !== undefined && !Nodes.hasBlueIdOnly(node)) {
      const isPositionedReference =
        context.insideItems &&
        ListControls.hasPositionProperty(node) &&
        Nodes.hasBlueIdOnly(ListControls.withoutPosition(node));
      if (isPositionedReference) {
        ListControls.readPosition(node);
      } else {
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
    }

    const childProperties = this.getChildProperties(node, path, context);
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
      this.validateNode(item, [...path, 'items', String(index)], {
        insideItems: true,
        itemIndex: index,
      });
    });

    const properties = node.getProperties();
    if (properties !== undefined) {
      for (const [key, property] of Object.entries(properties)) {
        this.validateNode(property, [...path, key], { insideItems: false });
      }
    }
  }

  private static validateListControlItem(
    node: BlueNode,
    path: string[],
    itemIndex: number,
  ): void {
    if (ListControls.hasEmptyProperty(node)) {
      if (ListControls.hasPreviousProperty(node)) {
        this.throwInvalidStorageShape(
          path,
          '$empty cannot be combined with $previous.',
        );
      }

      if (ListControls.hasPositionProperty(node)) {
        this.throwInvalidStorageShape(
          path,
          '$empty cannot be combined with $pos.',
        );
      }

      if (!ListControls.isEmptyItem(node)) {
        this.throwInvalidStorageShape(
          path,
          '$empty list content must be exactly { $empty: true }.',
        );
      }
    }

    if (ListControls.hasPreviousProperty(node)) {
      if (itemIndex !== 0) {
        this.throwInvalidStorageShape(
          path,
          '$previous list control is allowed only as the first item.',
        );
      }

      if (!ListControls.isPreviousItem(node)) {
        this.throwInvalidStorageShape(
          path,
          '$previous list control must be exactly { $previous: { blueId: <id> } }.',
        );
      }
    }

    if (ListControls.hasPositionProperty(node)) {
      if (ListControls.hasPreviousProperty(node)) {
        this.throwInvalidStorageShape(
          path,
          '$pos cannot be combined with $previous.',
        );
      }

      try {
        ListControls.readPosition(node);
      } catch (error) {
        this.throwInvalidStorageShape(
          [...path, LIST_POSITION_KEY],
          error instanceof Error
            ? error.message
            : '$pos must be a non-negative integer value.',
        );
      }

      if (!ListControls.hasPayloadAfterRemovingPosition(node)) {
        this.throwInvalidStorageShape(
          path,
          '$pos list control must include an item payload.',
        );
      }
    }
  }

  private static validateChild(
    node: BlueNode | undefined,
    path: string[],
  ): void {
    if (node !== undefined) {
      this.validateNode(node, path, { insideItems: false });
    }
  }

  private static validateListControlChild(
    node: BlueNode | undefined,
    path: string[],
  ): void {
    if (node !== undefined) {
      this.validateListControlNode(node, path);
    }
  }

  private static getChildProperties(
    node: BlueNode,
    path: string[],
    context: { insideItems: boolean },
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
        ([key]) =>
          !this.RESERVED_PROPERTY_KEYS.has(key) &&
          !(
            context.insideItems &&
            (key === LIST_POSITION_KEY || key === LIST_EMPTY_KEY)
          ),
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
