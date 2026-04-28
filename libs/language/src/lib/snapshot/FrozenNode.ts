import { BigDecimalNumber, BigIntegerNumber, BlueNode } from '../model';

type BlueNodeValue = ReturnType<BlueNode['getValue']>;

interface FrozenNodeFields {
  name?: string;
  description?: string;
  type?: FrozenNode;
  itemType?: FrozenNode;
  keyType?: FrozenNode;
  valueType?: FrozenNode;
  value?: BlueNodeValue;
  items?: readonly FrozenNode[];
  properties?: Readonly<Record<string, FrozenNode>>;
  referenceBlueId?: string;
  blue?: FrozenNode;
  inlineValue: boolean;
}

export class FrozenNode {
  private readonly name?: string;
  private readonly description?: string;
  private readonly type?: FrozenNode;
  private readonly itemType?: FrozenNode;
  private readonly keyType?: FrozenNode;
  private readonly valueType?: FrozenNode;
  private readonly value?: BlueNodeValue;
  private readonly items?: readonly FrozenNode[];
  private readonly properties?: Readonly<Record<string, FrozenNode>>;
  private readonly referenceBlueId?: string;
  private readonly blue?: FrozenNode;
  private readonly inlineValue: boolean;

  private constructor(fields: FrozenNodeFields) {
    this.name = fields.name;
    this.description = fields.description;
    this.type = fields.type;
    this.itemType = fields.itemType;
    this.keyType = fields.keyType;
    this.valueType = fields.valueType;
    this.value = cloneNodeValue(fields.value);
    this.items =
      fields.items === undefined ? undefined : Object.freeze([...fields.items]);
    this.properties =
      fields.properties === undefined
        ? undefined
        : Object.freeze({ ...fields.properties });
    this.referenceBlueId = fields.referenceBlueId;
    this.blue = fields.blue;
    this.inlineValue = fields.inlineValue;

    Object.freeze(this);
  }

  public static fromBlueNode(node: BlueNode): FrozenNode {
    const properties = node.getProperties();
    return new FrozenNode({
      name: node.getName(),
      description: node.getDescription(),
      type: freezeOptionalNode(node.getType()),
      itemType: freezeOptionalNode(node.getItemType()),
      keyType: freezeOptionalNode(node.getKeyType()),
      valueType: freezeOptionalNode(node.getValueType()),
      value: node.getValue(),
      items: node.getItems()?.map((item) => FrozenNode.fromBlueNode(item)),
      properties:
        properties === undefined
          ? undefined
          : Object.fromEntries(
              Object.entries(properties).map(([key, value]) => [
                key,
                FrozenNode.fromBlueNode(value),
              ]),
            ),
      referenceBlueId: node.getReferenceBlueId(),
      blue: freezeOptionalNode(node.getBlue()),
      inlineValue: node.isInlineValue(),
    });
  }

  public getName(): string | undefined {
    return this.name;
  }

  public getDescription(): string | undefined {
    return this.description;
  }

  public getType(): FrozenNode | undefined {
    return this.type;
  }

  public getItemType(): FrozenNode | undefined {
    return this.itemType;
  }

  public getKeyType(): FrozenNode | undefined {
    return this.keyType;
  }

  public getValueType(): FrozenNode | undefined {
    return this.valueType;
  }

  public getValue(): BlueNodeValue {
    return cloneNodeValue(this.value);
  }

  public getItems(): readonly FrozenNode[] | undefined {
    return this.items;
  }

  public getProperties(): Readonly<Record<string, FrozenNode>> | undefined {
    return this.properties;
  }

  public getReferenceBlueId(): string | undefined {
    return this.referenceBlueId;
  }

  /**
   * @deprecated Use getReferenceBlueId(). A node's blueId field is a reference,
   * not the node's own computed identity.
   */
  public getBlueId(): string | undefined {
    return this.getReferenceBlueId();
  }

  public getBlue(): FrozenNode | undefined {
    return this.blue;
  }

  public isInlineValue(): boolean {
    return this.inlineValue;
  }

  public toMutableNode(): BlueNode {
    const node = new BlueNode(this.name)
      .setDescription(this.description)
      .setType(this.type?.toMutableNode())
      .setItemType(this.itemType?.toMutableNode())
      .setKeyType(this.keyType?.toMutableNode())
      .setValueType(this.valueType?.toMutableNode())
      .setItems(this.items?.map((item) => item.toMutableNode()))
      .setProperties(
        this.properties === undefined
          ? undefined
          : Object.fromEntries(
              Object.entries(this.properties).map(([key, value]) => [
                key,
                value.toMutableNode(),
              ]),
            ),
      )
      .setReferenceBlueId(this.referenceBlueId)
      .setBlue(this.blue?.toMutableNode())
      .setInlineValue(this.inlineValue);

    const value = cloneNodeValue(this.value);
    if (value !== undefined) {
      node.setValue(value);
    }

    return node;
  }
}

function freezeOptionalNode(
  node: BlueNode | undefined,
): FrozenNode | undefined {
  return node === undefined ? undefined : FrozenNode.fromBlueNode(node);
}

function cloneNodeValue(value: BlueNodeValue): BlueNodeValue {
  if (value instanceof BigIntegerNumber) {
    return new BigIntegerNumber(value.toString());
  }

  if (value instanceof BigDecimalNumber) {
    return new BigDecimalNumber(value.toString());
  }

  return value;
}
