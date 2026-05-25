import { BlueNode } from '../model/Node';
import { BlueIdCalculator } from '../utils/BlueIdCalculator';

export type FrozenNodePathSegment = string | number;

export class FrozenNode {
  private cachedBlueId?: string;

  private constructor(
    private readonly node: BlueNode,
    private readonly strictCanonical = false,
    private readonly resolvedStructural = false,
  ) {}

  public static empty(): FrozenNode {
    return new FrozenNode(new BlueNode(), true, false);
  }

  public static fromNode(node: BlueNode): FrozenNode {
    return new FrozenNode(node.clone(), true, false);
  }

  public static fromResolvedNode(node: BlueNode): FrozenNode {
    return new FrozenNode(node.clone(), false, true);
  }

  public static fromUncheckedCanonicalNode(node: BlueNode): FrozenNode {
    return new FrozenNode(node.clone(), true, false);
  }

  public toNode(): BlueNode {
    return this.node.clone();
  }

  public blueId(): string {
    this.cachedBlueId ??= BlueIdCalculator.calculateBlueIdSync(this.node);
    return this.cachedBlueId;
  }

  public getName(): string | undefined {
    return this.node.getName();
  }

  public getDescription(): string | undefined {
    return this.node.getDescription();
  }

  public getType(): FrozenNode | undefined {
    return this.wrap(this.node.getType());
  }

  public getItemType(): FrozenNode | undefined {
    return this.wrap(this.node.getItemType());
  }

  public getKeyType(): FrozenNode | undefined {
    return this.wrap(this.node.getKeyType());
  }

  public getValueType(): FrozenNode | undefined {
    return this.wrap(this.node.getValueType());
  }

  public getValue(): ReturnType<BlueNode['getValue']> {
    return this.node.getValue();
  }

  public getItems(): FrozenNode[] | undefined {
    return this.node.getItems()?.map((item) => this.wrapRequired(item));
  }

  public getProperties(): Record<string, FrozenNode> | undefined {
    const properties = this.node.getProperties();
    if (properties === undefined) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        this.wrapRequired(value),
      ]),
    );
  }

  public getContracts(): FrozenNode | undefined {
    return this.wrap(this.node.getContractsNode());
  }

  public getReferenceBlueId(): string | undefined {
    return this.node.getReferenceBlueId();
  }

  public getSchema(): ReturnType<BlueNode['getSchema']> {
    return this.node.getSchema()?.clone();
  }

  public getMergePolicy(): string | undefined {
    return this.node.getMergePolicy();
  }

  public getPreviousBlueId(): string | undefined {
    return this.node.getPreviousBlueId();
  }

  public getPosition(): number | undefined {
    return this.node.getPosition();
  }

  public getBlue(): FrozenNode | undefined {
    return this.wrap(this.node.getBlue());
  }

  public property(key: string): FrozenNode | undefined {
    return this.wrap(this.node.getProperties()?.[key]);
  }

  public item(index: number): FrozenNode | undefined {
    return this.wrap(this.node.getItems()?.[index]);
  }

  public at(
    pointerOrSegments: string | readonly FrozenNodePathSegment[],
  ): FrozenNode | undefined {
    const segments =
      typeof pointerOrSegments === 'string'
        ? this.pointerSegments(pointerOrSegments)
        : pointerOrSegments.map(String);
    let current: BlueNode | undefined = this.node;
    for (const segment of segments) {
      if (current === undefined) {
        return undefined;
      }
      const index = Number(segment);
      current = Number.isInteger(index)
        ? current.getItems()?.[index]
        : current.getProperties()?.[segment];
    }
    return this.wrap(current);
  }

  public hasItems(): boolean {
    return (this.node.getItems()?.length ?? 0) > 0;
  }

  public hasProperties(): boolean {
    return Object.keys(this.node.getProperties() ?? {}).length > 0;
  }

  public isReferenceOnly(): boolean {
    return (
      this.node.getReferenceBlueId() !== undefined &&
      this.node.getName() === undefined &&
      this.node.getDescription() === undefined &&
      this.node.getType() === undefined &&
      this.node.getItemType() === undefined &&
      this.node.getKeyType() === undefined &&
      this.node.getValueType() === undefined &&
      this.node.getValue() === undefined &&
      this.node.getItems() === undefined &&
      this.node.getProperties() === undefined
    );
  }

  public isPreviousOnly(): boolean {
    return (
      this.node.getPreviousBlueId() !== undefined &&
      this.node.getItems() === undefined &&
      this.node.getProperties() === undefined
    );
  }

  public isStrictCanonical(): boolean {
    return this.strictCanonical;
  }

  public isResolvedStructural(): boolean {
    return this.resolvedStructural;
  }

  public isEmptyNode(): boolean {
    return (
      this.node.getName() === undefined &&
      this.node.getDescription() === undefined &&
      this.node.getType() === undefined &&
      this.node.getItemType() === undefined &&
      this.node.getKeyType() === undefined &&
      this.node.getValueType() === undefined &&
      this.node.getValue() === undefined &&
      this.node.getItems() === undefined &&
      this.node.getProperties() === undefined &&
      this.node.getReferenceBlueId() === undefined
    );
  }

  public withProperty(
    key: string,
    value: FrozenNode | BlueNode | undefined,
  ): FrozenNode {
    const next = this.node.clone();
    if (value === undefined) {
      next.removeProperty(key);
    } else {
      next.addProperty(
        key,
        value instanceof FrozenNode ? value.toNode() : value.clone(),
      );
    }
    return new FrozenNode(next, this.strictCanonical, this.resolvedStructural);
  }

  public withItems(items: readonly (FrozenNode | BlueNode)[]): FrozenNode {
    const next = this.node.clone();
    next.setItems(
      items.map((item) =>
        item instanceof FrozenNode ? item.toNode() : item.clone(),
      ),
    );
    return new FrozenNode(next, this.strictCanonical, this.resolvedStructural);
  }

  public withoutPosition(): FrozenNode {
    const next = this.node.clone();
    next.setPosition(undefined);
    return new FrozenNode(next, this.strictCanonical, this.resolvedStructural);
  }

  private wrap(node: BlueNode | undefined): FrozenNode | undefined {
    return node === undefined
      ? undefined
      : new FrozenNode(
          node.clone(),
          this.strictCanonical,
          this.resolvedStructural,
        );
  }

  private wrapRequired(node: BlueNode): FrozenNode {
    return new FrozenNode(
      node.clone(),
      this.strictCanonical,
      this.resolvedStructural,
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
}
