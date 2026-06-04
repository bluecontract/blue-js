import { BlueNode } from '../model/Node';
import { Schema } from '../model/Schema';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';
import { BlueIdInputValue } from '../utils/NodeToBlueIdInput';
import { OBJECT_CONTRACTS } from '../utils/Properties';
import { FrozenNodeToBlueIdInput } from './FrozenNodeToBlueIdInput';

export type FrozenNodePathSegment = string | number;

export class FrozenNode {
  private readonly name?: string;
  private readonly description?: string;
  private readonly type?: FrozenNode;
  private readonly itemType?: FrozenNode;
  private readonly keyType?: FrozenNode;
  private readonly valueType?: FrozenNode;
  private readonly value: ReturnType<BlueNode['getValue']>;
  private readonly items?: readonly FrozenNode[];
  private readonly properties?: Readonly<Record<string, FrozenNode>>;
  private readonly contracts?: FrozenNode;
  private readonly referenceBlueId?: string;
  private readonly schema?: Schema;
  private readonly mergePolicy?: string;
  private readonly previousBlueId?: string;
  private readonly position?: number;
  private readonly blue?: FrozenNode;
  private readonly inlineValue: boolean;
  private readonly blueIdValue: string;

  private constructor(
    node: BlueNode,
    private readonly strictCanonical = false,
    private readonly resolvedStructural = false,
    private readonly strictBlueIdValidation = true,
    private readonly listElementContext = false,
  ) {
    this.name = node.getName();
    this.description = node.getDescription();
    this.type = this.freezeChild(node.getType(), false);
    this.itemType = this.freezeChild(node.getItemType(), false);
    this.keyType = this.freezeChild(node.getKeyType(), false);
    this.valueType = this.freezeChild(node.getValueType(), false);
    this.value = node.getValue();
    this.items = this.freezeItems(node.getItems());
    this.properties = this.freezeProperties(node.getProperties());
    this.contracts = this.freezeChild(node.getContractsNode(), false);
    this.referenceBlueId = node.getReferenceBlueId();
    this.schema = node.getSchema()?.clone();
    this.mergePolicy = node.getMergePolicy();
    this.previousBlueId = node.getPreviousBlueId();
    this.position = node.getPosition();
    this.blue = this.freezeChild(node.getBlue(), false);
    this.inlineValue = node.isInlineValue();

    this.validatePayloadShape();
    this.blueIdValue = this.computeBlueId();
  }

  public static empty(): FrozenNode {
    return new FrozenNode(new BlueNode(), true, false);
  }

  public static fromNode(node: BlueNode): FrozenNode {
    return new FrozenNode(node, true, false);
  }

  public static fromResolvedNode(node: BlueNode): FrozenNode {
    return new FrozenNode(node, false, true, false);
  }

  public static fromUncheckedCanonicalNode(node: BlueNode): FrozenNode {
    return new FrozenNode(node, true, false, false);
  }

  public static calculateBlueId(nodes: readonly FrozenNode[]): string {
    return BlueIdCalculator.calculateBlueIdSync(
      nodes.map((node) => node.toNode()),
    );
  }

  public toNode(): BlueNode {
    const node = new BlueNode()
      .setName(this.name)
      .setDescription(this.description)
      .setType(this.type?.toNode())
      .setItemType(this.itemType?.toNode())
      .setKeyType(this.keyType?.toNode())
      .setValueType(this.valueType?.toNode())
      .setReferenceBlueId(this.referenceBlueId)
      .setSchema(this.schema?.clone())
      .setMergePolicy(this.mergePolicy)
      .setPreviousBlueId(this.previousBlueId)
      .setPosition(this.position)
      .setBlue(this.blue?.toNode())
      .setInlineValue(this.inlineValue);

    if (this.value !== undefined) {
      node.setValue(this.value);
    }
    if (this.items !== undefined) {
      node.setItems(this.items.map((item) => item.toNode()));
    }
    if (this.properties !== undefined) {
      node.setProperties(
        Object.fromEntries(
          Object.entries(this.properties).map(([key, value]) => [
            key,
            value.toNode(),
          ]),
        ),
      );
    }
    if (this.contracts !== undefined) {
      node.setContractsNode(this.contracts.toNode());
    }
    return node;
  }

  public blueId(): string {
    return this.blueIdValue;
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

  public getValue(): ReturnType<BlueNode['getValue']> {
    return this.value;
  }

  public getItems(): readonly FrozenNode[] | undefined {
    return this.items;
  }

  public getProperties(): Readonly<Record<string, FrozenNode>> | undefined {
    return this.properties;
  }

  public getContracts(): FrozenNode | undefined {
    return this.contracts;
  }

  public getReferenceBlueId(): string | undefined {
    return this.referenceBlueId;
  }

  public getSchema(): Schema | undefined {
    return this.schema?.clone();
  }

  public getMergePolicy(): string | undefined {
    return this.mergePolicy;
  }

  public getPreviousBlueId(): string | undefined {
    return this.previousBlueId;
  }

  public getPosition(): number | undefined {
    return this.position;
  }

  public getBlue(): FrozenNode | undefined {
    return this.blue;
  }

  public isInlineValue(): boolean {
    return this.inlineValue;
  }

  public property(key: string): FrozenNode | undefined {
    if (key === OBJECT_CONTRACTS) {
      return this.contracts;
    }
    return this.properties?.[key];
  }

  public item(index: number): FrozenNode | undefined {
    return index >= 0 ? this.items?.[index] : undefined;
  }

  public at(
    pointerOrSegments: string | readonly FrozenNodePathSegment[],
  ): FrozenNode | undefined {
    const segments =
      typeof pointerOrSegments === 'string'
        ? this.pointerSegments(pointerOrSegments)
        : pointerOrSegments.map(String);
    return FrozenNode.atSegments(this, segments);
  }

  private static atSegments(
    root: FrozenNode,
    segments: readonly string[],
  ): FrozenNode | undefined {
    let current: FrozenNode | undefined = root;
    for (const segment of segments) {
      if (current === undefined) {
        return undefined;
      }
      if (current.items !== undefined && segment !== OBJECT_CONTRACTS) {
        current = current.item(FrozenNode.parseArrayIndex(segment));
      } else {
        current = current.property(segment);
      }
    }
    return current;
  }

  public pathIndex(): ReadonlyMap<string, FrozenNode> {
    const index = new Map<string, FrozenNode>();
    this.indexPaths('/', index);
    return index;
  }

  public hasItems(): boolean {
    return this.items !== undefined;
  }

  public hasProperties(): boolean {
    return this.properties !== undefined;
  }

  public isReferenceOnly(): boolean {
    return (
      this.referenceBlueId !== undefined &&
      this.name === undefined &&
      this.description === undefined &&
      this.type === undefined &&
      this.itemType === undefined &&
      this.keyType === undefined &&
      this.valueType === undefined &&
      (this.value === undefined || this.value === null) &&
      this.items === undefined &&
      this.properties === undefined &&
      this.contracts === undefined &&
      this.schema === undefined &&
      this.mergePolicy === undefined &&
      this.previousBlueId === undefined &&
      this.position === undefined &&
      this.blue === undefined
    );
  }

  public isPreviousOnly(): boolean {
    return (
      this.previousBlueId !== undefined &&
      this.name === undefined &&
      this.description === undefined &&
      this.type === undefined &&
      this.itemType === undefined &&
      this.keyType === undefined &&
      this.valueType === undefined &&
      (this.value === undefined || this.value === null) &&
      this.items === undefined &&
      this.properties === undefined &&
      this.contracts === undefined &&
      this.schema === undefined &&
      this.mergePolicy === undefined &&
      this.position === undefined &&
      this.blue === undefined &&
      this.referenceBlueId === undefined
    );
  }

  public isStrictCanonical(): boolean {
    return this.strictCanonical;
  }

  public isResolvedStructural(): boolean {
    return this.resolvedStructural;
  }

  public isStrictBlueIdValidation(): boolean {
    return this.strictBlueIdValidation;
  }

  public isListElementContext(): boolean {
    return this.listElementContext;
  }

  public isEmptyNode(): boolean {
    return (
      this.name === undefined &&
      this.description === undefined &&
      this.type === undefined &&
      this.itemType === undefined &&
      this.keyType === undefined &&
      this.valueType === undefined &&
      (this.value === undefined || this.value === null) &&
      this.items === undefined &&
      this.properties === undefined &&
      this.contracts === undefined &&
      this.referenceBlueId === undefined &&
      this.schema === undefined &&
      this.mergePolicy === undefined &&
      this.previousBlueId === undefined &&
      this.position === undefined &&
      this.blue === undefined
    );
  }

  public withProperty(
    key: string,
    value: FrozenNode | BlueNode | undefined,
  ): FrozenNode {
    const next = this.toNode();
    if (key === OBJECT_CONTRACTS) {
      next.setContractsNode(this.nodeOrUndefined(value));
    } else if (value === undefined) {
      next.removeProperty(key);
    } else {
      const child =
        value instanceof FrozenNode ? value.toNode() : value.clone();
      next.addProperty(key, child);
    }
    return new FrozenNode(
      next,
      this.strictCanonical,
      this.resolvedStructural,
      this.strictBlueIdValidation,
      this.listElementContext,
    );
  }

  public withItems(items: readonly (FrozenNode | BlueNode)[]): FrozenNode {
    const next = this.toNode();
    next.setItems(
      items.map((item) =>
        item instanceof FrozenNode ? item.toNode() : item.clone(),
      ),
    );
    return new FrozenNode(
      next,
      this.strictCanonical,
      this.resolvedStructural,
      this.strictBlueIdValidation,
      this.listElementContext,
    );
  }

  public withoutPosition(): FrozenNode {
    if (this.position === undefined) {
      return this;
    }
    const next = this.toNode();
    next.setPosition(undefined);
    return new FrozenNode(
      next,
      this.strictCanonical,
      this.resolvedStructural,
      this.strictBlueIdValidation,
      this.listElementContext,
    );
  }

  private freezeChild(
    node: BlueNode | undefined,
    listElementContext: boolean,
  ): FrozenNode | undefined {
    return node === undefined
      ? undefined
      : new FrozenNode(
          node,
          this.strictCanonical,
          this.resolvedStructural,
          this.strictBlueIdValidation,
          listElementContext,
        );
  }

  private freezeItems(
    items: BlueNode[] | undefined,
  ): readonly FrozenNode[] | undefined {
    if (items === undefined) {
      return undefined;
    }
    return Object.freeze(
      items.map(
        (item) =>
          new FrozenNode(
            item,
            this.strictCanonical,
            this.resolvedStructural,
            this.strictBlueIdValidation,
            true,
          ),
      ),
    );
  }

  private freezeProperties(
    properties: Record<string, BlueNode> | undefined,
  ): Readonly<Record<string, FrozenNode>> | undefined {
    if (properties === undefined) {
      return undefined;
    }
    const entries = Object.entries(properties).flatMap(([key, value]) => {
      if (key === OBJECT_CONTRACTS) {
        return [];
      }
      const child = new FrozenNode(
        value,
        this.strictCanonical,
        this.resolvedStructural,
        this.strictBlueIdValidation,
        false,
      );
      return this.strictCanonical && child.isEmptyNode()
        ? []
        : [[key, child] as const];
    });
    return entries.length === 0
      ? undefined
      : Object.freeze(Object.fromEntries(entries));
  }

  private validatePayloadShape(): void {
    const payloadKinds = [
      this.value !== undefined && this.value !== null,
      this.items !== undefined,
      this.properties !== undefined && Object.keys(this.properties).length > 0,
    ].filter(Boolean).length;
    if (payloadKinds > 1) {
      throw new Error(
        'A Blue node may contain only one payload kind: value, items, or object fields.',
      );
    }
    if (
      this.strictCanonical &&
      this.referenceBlueId !== undefined &&
      !this.isReferenceOnly()
    ) {
      throw new Error(
        '"blueId" nodes must be reference-only and cannot contain sibling fields.',
      );
    }
    if (this.strictCanonical && this.previousBlueId !== undefined) {
      if (!this.isPreviousOnly()) {
        throw new Error(
          '"$previous" list anchors must be single-key list items.',
        );
      }
      if (!this.listElementContext) {
        throw new Error(
          '"$previous" is valid only as the first list item in direct BlueId input.',
        );
      }
    }
    if (this.strictCanonical && this.blue !== undefined) {
      throw new Error(
        '"blue" is a preprocessing directive and must not appear in canonical BlueId input.',
      );
    }
    if (this.strictCanonical && this.position !== undefined) {
      throw new Error('"$pos" overlays are not valid direct BlueId input.');
    }
  }

  private computeBlueId(): string {
    if (this.strictCanonical) {
      if (!this.strictBlueIdValidation) {
        return BlueIdCalculator.calculateBlueIdSync(this.toNode());
      }
      return BlueIdCalculator.calculateBlueIdInputSync(
        FrozenNodeToBlueIdInput.toBlueIdInput(this) as BlueIdInputValue,
      );
    }
    if (this.isReferenceOnly()) {
      return this.referenceBlueId as string;
    }
    return BlueIdCalculator.calculateBlueIdWithResolvedBlueIdMetadataSync(
      this.toNode(),
    );
  }

  private nodeOrUndefined(
    value: FrozenNode | BlueNode | undefined,
  ): BlueNode | undefined {
    if (value === undefined) {
      return undefined;
    }
    return value instanceof FrozenNode ? value.toNode() : value.clone();
  }

  private indexPaths(path: string, index: Map<string, FrozenNode>): void {
    index.set(path, this);
    this.items?.forEach((item, itemIndex) =>
      item.indexPaths(this.appendPointer(path, String(itemIndex)), index),
    );
    Object.entries(this.properties ?? {}).forEach(([key, child]) =>
      child.indexPaths(this.appendPointer(path, key), index),
    );
    this.contracts?.indexPaths(
      this.appendPointer(path, OBJECT_CONTRACTS),
      index,
    );
  }

  private pointerSegments(pointer: string): string[] {
    if (pointer === '' || pointer === '/') {
      return [];
    }
    return pointer
      .replace(/^\//, '')
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  }

  private appendPointer(path: string, segment: string): string {
    const escaped = segment.replace(/~/g, '~0').replace(/\//g, '~1');
    return path === '/' ? `/${escaped}` : `${path}/${escaped}`;
  }

  private static parseArrayIndex(segment: string): number {
    const index = Number(segment);
    return Number.isInteger(index) && index >= 0 ? index : -1;
  }
}
