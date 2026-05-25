import { BlueNode, isBigNumber, Properties } from '@blue-labs/language';

export type BexSimple =
  | undefined
  | null
  | string
  | number
  | boolean
  | BexSimple[]
  | { [key: string]: BexSimple };

export interface BexBlueOutputOptions {
  readonly allowConstraints?: boolean;
  readonly allowComputedBlue?: boolean;
}

export class BexValue {
  constructor(public readonly value: BexSimple) {}

  public isUndefined(): boolean {
    return this.value === undefined;
  }

  public toSimple(): BexSimple {
    return this.value;
  }

  public asText(): string {
    if (this.value === undefined || this.value === null) {
      return '';
    }
    if (
      typeof this.value === 'string' ||
      typeof this.value === 'number' ||
      typeof this.value === 'boolean'
    ) {
      return String(this.value);
    }
    throw new Error('Cannot convert non-scalar BEX value to text.');
  }

  public get(key: string): BexValue {
    if (Array.isArray(this.value)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < this.value.length) {
        return new BexValue(this.value[index]);
      }
      return BexValues.undefined();
    }
    if (
      this.value !== null &&
      typeof this.value === 'object' &&
      this.value !== undefined
    ) {
      return new BexValue(this.value[key]);
    }
    return BexValues.undefined();
  }

  public toBlueNodeStrict(options?: BexBlueOutputOptions): BlueNode {
    return BexValues.toBlueNodeStrict(this.value, options);
  }
}

export class BexValues {
  private static readonly UNDEFINED = new BexValue(undefined);
  private static readonly NULL = new BexValue(null);

  public static undefined(): BexValue {
    return this.UNDEFINED;
  }

  public static nullValue(): BexValue {
    return this.NULL;
  }

  public static fromSimple(value: unknown): BexValue {
    return new BexValue(this.normalize(value));
  }

  public static nodeSnapshot(node: BlueNode | undefined): BexValue {
    if (node === undefined) {
      return this.undefined();
    }
    return this.fromSimple(nodeToSimple(node));
  }

  public static truthy(value: BexValue): boolean {
    const simple = value.toSimple();
    if (simple === undefined || simple === null || simple === false) {
      return false;
    }
    if (simple === '') {
      return false;
    }
    if (Array.isArray(simple)) {
      return simple.length > 0;
    }
    if (typeof simple === 'object') {
      return Object.keys(simple).length > 0;
    }
    return true;
  }

  public static equal(left: BexValue, right: BexValue): boolean {
    return JSON.stringify(left.toSimple()) === JSON.stringify(right.toSimple());
  }

  public static toBlueNodeStrict(
    value: unknown,
    options: BexBlueOutputOptions = {},
  ): BlueNode {
    if (value === undefined) {
      throw new Error('BEX output root cannot be undefined.');
    }
    return this.simpleToBlueNodeStrict(value, options, '$');
  }

  private static normalize(value: unknown): BexSimple {
    if (value === undefined || value === null) {
      return value;
    }
    if (isBigNumber(value) || isBigLikeNumber(value)) {
      return value.toNumber();
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.normalize(item));
    }
    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.normalize(item),
        ]),
      );
    }
    return String(value);
  }

  private static simpleToBlueNodeStrict(
    value: unknown,
    options: BexBlueOutputOptions,
    path: string,
  ): BlueNode {
    if (value === undefined) {
      throw new Error(`BEX output at ${path} cannot be undefined.`);
    }
    if (value === null) {
      return new BlueNode();
    }
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return new BlueNode().setValue(value);
    }
    if (Array.isArray(value)) {
      return new BlueNode().setItems(
        value.map((item, index) =>
          this.simpleToBlueNodeStrict(item, options, `${path}/${index}`),
        ),
      );
    }
    if (!isPlainObject(value)) {
      throw new Error(`Unsupported BEX output at ${path}: ${String(value)}`);
    }

    const keys = Object.keys(value);
    if ('blueId' in value) {
      if (
        keys.length !== 1 ||
        typeof (value as Record<string, unknown>).blueId !== 'string'
      ) {
        throw new Error(`BEX output at ${path} has mixed blueId fields.`);
      }
      return new BlueNode().setReferenceBlueId(
        (value as Record<string, string>).blueId,
      );
    }
    if ('schema' in value && 'constraints' in value) {
      throw new Error(
        `BEX output at ${path} must not mix schema and constraints.`,
      );
    }
    if ('properties' in value) {
      throw new Error(`BEX output at ${path} must not use properties wrapper.`);
    }
    if ('constraints' in value && options.allowConstraints !== true) {
      throw new Error(`BEX output at ${path} must not use constraints.`);
    }
    if ('blue' in value && options.allowComputedBlue !== true) {
      throw new Error(`BEX output at ${path} must not use computed blue.`);
    }
    for (const key of ['$previous', '$pos', '$replace', '$empty']) {
      if (key in value) {
        throw new Error(
          `BEX output at ${path} contains unsupported list-control field ${key}.`,
        );
      }
    }

    const ordinaryKeys = keys.filter(
      (key) => !RESERVED_BLUE_OUTPUT_KEYS.has(key),
    );
    const hasValue = Object.prototype.hasOwnProperty.call(value, 'value');
    const hasItems = Object.prototype.hasOwnProperty.call(value, 'items');
    if (
      (hasValue && (hasItems || ordinaryKeys.length > 0)) ||
      (hasItems && ordinaryKeys.length > 0)
    ) {
      throw new Error(`BEX output at ${path} mixes payload kinds.`);
    }

    const node = new BlueNode();
    this.applyOptionalText(value, 'name', path, (text) => node.setName(text));
    this.applyOptionalText(value, 'description', path, (text) =>
      node.setDescription(text),
    );
    this.applyOptionalNode(value, 'type', path, options, (child) =>
      node.setType(child),
    );
    this.applyOptionalNode(value, 'itemType', path, options, (child) =>
      node.setItemType(child),
    );
    this.applyOptionalNode(value, 'keyType', path, options, (child) =>
      node.setKeyType(child),
    );
    this.applyOptionalNode(value, 'valueType', path, options, (child) =>
      node.setValueType(child),
    );
    if (hasValue) {
      const scalar = value.value;
      if (
        scalar !== null &&
        typeof scalar !== 'string' &&
        typeof scalar !== 'number' &&
        typeof scalar !== 'boolean'
      ) {
        throw new Error(`BEX output value at ${path}/value must be scalar.`);
      }
      node.setValue((scalar ?? null) as null | string | number | boolean);
    }
    if (hasItems) {
      if (!Array.isArray(value.items)) {
        throw new Error(`BEX output items at ${path}/items must be a list.`);
      }
      node.setItems(
        value.items.map((item, index) =>
          this.simpleToBlueNodeStrict(item, options, `${path}/items/${index}`),
        ),
      );
    }
    this.applyOptionalNode(value, 'contracts', path, options, (child) =>
      node.setContractsNode(child),
    );
    if ('schema' in value) {
      node.setSchema(this.schemaFromSimple(value.schema, options, path));
    }
    this.applyOptionalText(value, 'mergePolicy', path, (text) =>
      node.setMergePolicy(text),
    );

    for (const key of ordinaryKeys) {
      node.addProperty(
        key,
        this.simpleToBlueNodeStrict(value[key], options, `${path}/${key}`),
      );
    }
    return node;
  }

  private static applyOptionalText(
    value: Record<string, unknown>,
    key: string,
    path: string,
    apply: (text: string) => void,
  ): void {
    const child = value[key];
    if (child === undefined) {
      return;
    }
    if (typeof child !== 'string') {
      throw new Error(`BEX output ${path}/${key} must be text.`);
    }
    apply(child);
  }

  private static applyOptionalNode(
    value: Record<string, unknown>,
    key: string,
    path: string,
    options: BexBlueOutputOptions,
    apply: (child: BlueNode) => void,
  ): void {
    const child = value[key];
    if (child === undefined) {
      return;
    }
    apply(this.simpleToBlueNodeStrict(child, options, `${path}/${key}`));
  }

  private static schemaFromSimple(
    value: unknown,
    options: BexBlueOutputOptions,
    path: string,
  ): BlueSchema {
    if (!isPlainObject(value)) {
      throw new Error(`BEX output schema at ${path}/schema must be an object.`);
    }
    const schema = new BexSchemaAdapter();
    for (const [key, child] of Object.entries(value)) {
      if (key === 'enum') {
        if (!Array.isArray(child)) {
          throw new Error(
            `BEX output schema enum at ${path}/schema/enum must be a list.`,
          );
        }
        schema.setEnum(
          child.map((item, index) =>
            this.simpleToBlueNodeStrict(
              item,
              options,
              `${path}/schema/enum/${index}`,
            ),
          ),
        );
        continue;
      }
      if (!isBexSchemaField(key)) {
        throw new Error(
          `BEX output schema at ${path}/schema contains unsupported key ${key}.`,
        );
      }
      schema.set(
        key,
        this.simpleToBlueNodeStrict(child, options, `${path}/schema/${key}`),
      );
    }
    return schema as unknown as BlueSchema;
  }
}

const BEX_SCHEMA_FIELDS = [
  'required',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minFields',
  'maxFields',
] as const;

type BexSchemaField = (typeof BEX_SCHEMA_FIELDS)[number];
type BlueSchema = NonNullable<ReturnType<BlueNode['getSchema']>>;

class BexSchemaAdapter {
  private readonly fields: Partial<Record<BexSchemaField, BlueNode>> = {};
  private enumValues?: BlueNode[];

  public get(field: BexSchemaField): BlueNode | undefined {
    return this.fields[field];
  }

  public set(field: BexSchemaField, value: BlueNode | undefined): this {
    if (value === undefined) {
      delete this.fields[field];
    } else {
      this.fields[field] = value;
    }
    return this;
  }

  public getEnum(): BlueNode[] | undefined {
    return this.enumValues;
  }

  public setEnum(values: BlueNode[] | undefined): this {
    this.enumValues = values;
    return this;
  }

  public entries(): [BexSchemaField, BlueNode][] {
    return BEX_SCHEMA_FIELDS.flatMap((field) => {
      const value = this.fields[field];
      return value === undefined
        ? []
        : ([[field, value]] as [BexSchemaField, BlueNode][]);
    });
  }

  public clone(): BexSchemaAdapter {
    const cloned = new BexSchemaAdapter();
    for (const [field, value] of this.entries()) {
      cloned.set(field, value.clone());
    }
    cloned.setEnum(this.enumValues?.map((value) => value.clone()));
    return cloned;
  }
}

function isBexSchemaField(value: string): value is BexSchemaField {
  return (BEX_SCHEMA_FIELDS as readonly string[]).includes(value);
}

const RESERVED_BLUE_OUTPUT_KEYS = new Set([
  'name',
  'description',
  'type',
  'itemType',
  'keyType',
  'valueType',
  'value',
  'items',
  'blueId',
  'blue',
  'schema',
  'constraints',
  'mergePolicy',
  'properties',
  'contracts',
]);

interface BigLikeNumber {
  readonly c?: unknown;
  readonly e?: unknown;
  readonly s?: unknown;
  toNumber(): number;
}

function isBigLikeNumber(value: unknown): value is BigLikeNumber {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<BigLikeNumber>).toNumber === 'function' &&
    Array.isArray((value as Partial<BigLikeNumber>).c) &&
    typeof (value as Partial<BigLikeNumber>).e === 'number' &&
    typeof (value as Partial<BigLikeNumber>).s === 'number'
  );
}

function isPlainObject(value: unknown): value is Record<string, BexSimple> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nodeToSimple(node: BlueNode): BexSimple {
  const metadata = nodeMetadataToSimple(node);
  const metadataKeys = Object.keys(metadata);
  const value = node.getValue();
  if (
    value !== undefined &&
    (metadataKeys.length === 0 || hasOnlyPrimitiveTypeMetadata(node))
  ) {
    return BexValues.fromSimple(value).toSimple();
  }
  const items = node.getItems();
  if (items !== undefined && metadataKeys.length === 0) {
    return items.map((item) => nodeToSimple(item));
  }
  const result: Record<string, BexSimple> = { ...metadata };
  if (value !== undefined) {
    result.value = BexValues.fromSimple(value).toSimple();
  }
  if (items !== undefined) {
    result.items = items.map((item) => nodeToSimple(item));
  }
  const properties = node.getProperties();
  for (const [key, child] of Object.entries(properties ?? {})) {
    result[key] = nodeToSimple(child);
  }
  return result;
}

function hasOnlyPrimitiveTypeMetadata(node: BlueNode): boolean {
  const typeBlueId = node.getType()?.getReferenceBlueId();
  return (
    typeBlueId !== undefined &&
    BASIC_SCALAR_TYPE_BLUE_IDS.has(typeBlueId) &&
    node.getName() === undefined &&
    node.getDescription() === undefined &&
    node.getItemType() === undefined &&
    node.getKeyType() === undefined &&
    node.getValueType() === undefined &&
    node.getReferenceBlueId() === undefined &&
    node.getSchema() === undefined &&
    node.getMergePolicy() === undefined &&
    node.getContractsNode() === undefined &&
    node.getBlue() === undefined
  );
}

const BASIC_SCALAR_TYPE_BLUE_IDS = new Set<string>([
  Properties.TEXT_TYPE_BLUE_ID,
  Properties.INTEGER_TYPE_BLUE_ID,
  Properties.DOUBLE_TYPE_BLUE_ID,
  Properties.BOOLEAN_TYPE_BLUE_ID,
]);

function nodeMetadataToSimple(node: BlueNode): Record<string, BexSimple> {
  const result: Record<string, BexSimple> = {};
  const name = node.getName();
  if (name !== undefined) {
    result.name = name;
  }
  const description = node.getDescription();
  if (description !== undefined) {
    result.description = description;
  }
  const type = node.getType();
  if (type !== undefined) {
    result.type = nodeToSimple(type);
  }
  const itemType = node.getItemType();
  if (itemType !== undefined) {
    result.itemType = nodeToSimple(itemType);
  }
  const keyType = node.getKeyType();
  if (keyType !== undefined) {
    result.keyType = nodeToSimple(keyType);
  }
  const valueType = node.getValueType();
  if (valueType !== undefined) {
    result.valueType = nodeToSimple(valueType);
  }
  const blueId = node.getReferenceBlueId();
  if (blueId !== undefined) {
    result.blueId = blueId;
  }
  const schema = node.getSchema();
  if (schema !== undefined) {
    result.schema = schemaToSimple(schema);
  }
  const mergePolicy = node.getMergePolicy();
  if (mergePolicy !== undefined) {
    result.mergePolicy = mergePolicy;
  }
  const contracts = node.getContractsNode();
  if (contracts !== undefined) {
    result.contracts = nodeToSimple(contracts);
  }
  const blue = node.getBlue();
  if (blue !== undefined) {
    result.blue = nodeToSimple(blue);
  }
  return result;
}

function schemaToSimple(schema: BlueSchema): BexSimple {
  const result: Record<string, BexSimple> = {};
  for (const [field, value] of schema.entries()) {
    result[field] = nodeToSimple(value);
  }
  const enumValues = schema.getEnum();
  if (enumValues !== undefined) {
    result.enum = enumValues.map((value: BlueNode) => nodeToSimple(value));
  }
  return result;
}
