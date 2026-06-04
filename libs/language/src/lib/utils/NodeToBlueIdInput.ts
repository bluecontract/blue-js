import { JsonBlueValue } from '../../schema';
import { isBigIntegerNumber, isBigNumber } from '../../utils/typeGuards';
import { BigDecimalNumber } from '../model/BigDecimalNumber';
import { BigIntegerNumber } from '../model/BigIntegerNumber';
import { BlueNode } from '../model/Node';
import { Schema } from '../model/Schema';
import { BlueIds } from './BlueIds';
import { BlueNumbers } from './BlueNumbers';
import {
  BOOLEAN_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  LIST_CONTROL_EMPTY,
  LIST_CONTROL_PREVIOUS,
  LIST_CONTROL_REPLACE,
  OBJECT_BLUE_ID,
  OBJECT_CONTRACTS,
  OBJECT_DESCRIPTION,
  OBJECT_ITEMS,
  OBJECT_ITEM_TYPE,
  OBJECT_KEY_TYPE,
  OBJECT_MERGE_POLICY,
  OBJECT_NAME,
  OBJECT_SCHEMA,
  OBJECT_TYPE,
  OBJECT_VALUE,
  OBJECT_VALUE_TYPE,
  TEXT_TYPE_BLUE_ID,
} from './Properties';

export type BlueIdInputValue =
  | string
  | number
  | boolean
  | BlueIdInputValue[]
  | { [key: string]: BlueIdInputValue };

type Context = 'root' | 'object-field' | 'list-element' | 'metadata';

const MIN_SAFE = new BigIntegerNumber(Number.MIN_SAFE_INTEGER.toString());
const MAX_SAFE = new BigIntegerNumber(Number.MAX_SAFE_INTEGER.toString());

export class NodeToBlueIdInput {
  public static get(node: BlueNode): BlueIdInputValue {
    return this.getNode(node, '/', 'root', -1, false);
  }

  public static getAllowingCyclicPlaceholders(
    node: BlueNode,
  ): BlueIdInputValue {
    return this.getNode(node, '/', 'root', -1, true);
  }

  public static getWithResolvedBlueIdMetadata(
    node: BlueNode,
  ): BlueIdInputValue {
    return this.getNode(
      this.stripResolvedBlueIdMetadata(node.clone()),
      '/',
      'root',
      -1,
      false,
    );
  }

  public static stripResolvedBlueIdMetadata(node: BlueNode): BlueNode {
    if (
      node.getReferenceBlueId() !== undefined &&
      !this.isReferenceOnly(node)
    ) {
      node.setReferenceBlueId(undefined);
    }
    this.stripResolvedBlueIdMetadataChild(node.getType());
    this.stripResolvedBlueIdMetadataChild(node.getItemType());
    this.stripResolvedBlueIdMetadataChild(node.getKeyType());
    this.stripResolvedBlueIdMetadataChild(node.getValueType());
    this.stripResolvedBlueIdMetadataChild(node.getBlue());
    this.stripResolvedBlueIdMetadataChild(node.getContractsNode());
    node.getItems()?.forEach((item) => this.stripResolvedBlueIdMetadata(item));
    Object.values(node.getProperties() ?? {}).forEach((value) =>
      this.stripResolvedBlueIdMetadata(value),
    );
    const schema = node.getSchema();
    schema
      ?.entries()
      .forEach(([, value]) => this.stripResolvedBlueIdMetadata(value));
    schema
      ?.getEnum()
      ?.forEach((value) => this.stripResolvedBlueIdMetadata(value));
    return node;
  }

  private static stripResolvedBlueIdMetadataChild(
    node: BlueNode | undefined,
  ): void {
    if (node !== undefined) {
      this.stripResolvedBlueIdMetadata(node);
    }
  }

  public static getListElement(
    node: BlueNode,
    index: number,
  ): BlueIdInputValue {
    return this.getNode(node, `/${index}`, 'list-element', index, false);
  }

  public static getListElementAllowingCyclicPlaceholders(
    node: BlueNode,
    index: number,
  ): BlueIdInputValue {
    return this.getNode(node, `/${index}`, 'list-element', index, true);
  }

  private static getNode(
    node: BlueNode | undefined,
    path: string,
    context: Context,
    listIndex: number,
    allowCyclicPlaceholders: boolean,
  ): BlueIdInputValue {
    this.validateBlueIdInput(node, path, context, listIndex);

    if (context === 'list-element' && this.isEmptyPlaceholder(node)) {
      return { [LIST_CONTROL_EMPTY]: true };
    }

    if (this.isReferenceOnly(node)) {
      const blueId = this.validateReferenceBlueId(
        node.getReferenceBlueId(),
        this.appendPath(path, OBJECT_BLUE_ID),
        allowCyclicPlaceholders,
      );
      return { [OBJECT_BLUE_ID]: blueId };
    }

    if (node.getPreviousBlueId() !== undefined) {
      const previousBlueId = BlueIds.requirePlainBlueId(
        node.getPreviousBlueId(),
        this.appendPath(
          this.appendPath(path, LIST_CONTROL_PREVIOUS),
          OBJECT_BLUE_ID,
        ),
      );
      return {
        [LIST_CONTROL_PREVIOUS]: {
          [OBJECT_BLUE_ID]: previousBlueId,
        },
      };
    }

    const value = node.getValue();
    const nodeItems = node.getItems();
    const items =
      nodeItems === undefined
        ? undefined
        : nodeItems.map((item, index) =>
            this.getNode(
              item,
              this.appendPath(
                this.appendPath(path, OBJECT_ITEMS),
                String(index),
              ),
              'list-element',
              index,
              allowCyclicPlaceholders,
            ),
          );
    if (items !== undefined && this.isPayloadOnlyList(node)) {
      return items;
    }

    const result: { [key: string]: BlueIdInputValue } = {};
    this.setString(result, OBJECT_NAME, node.getName());
    this.setString(result, OBJECT_DESCRIPTION, node.getDescription());

    let valueTypeBlueId: string | undefined;
    if (value !== undefined && value !== null && node.getType() === undefined) {
      valueTypeBlueId = this.inferTypeBlueId(value);
      if (valueTypeBlueId !== undefined) {
        result[OBJECT_TYPE] = { [OBJECT_BLUE_ID]: valueTypeBlueId };
      }
    } else if (node.getType() !== undefined) {
      valueTypeBlueId = node.getType()?.getReferenceBlueId();
      result[OBJECT_TYPE] = this.getNode(
        node.getType(),
        this.appendPath(path, OBJECT_TYPE),
        'metadata',
        -1,
        allowCyclicPlaceholders,
      );
    }

    this.setNode(
      result,
      OBJECT_ITEM_TYPE,
      node.getItemType(),
      path,
      allowCyclicPlaceholders,
    );
    this.setNode(
      result,
      OBJECT_KEY_TYPE,
      node.getKeyType(),
      path,
      allowCyclicPlaceholders,
    );
    this.setNode(
      result,
      OBJECT_VALUE_TYPE,
      node.getValueType(),
      path,
      allowCyclicPlaceholders,
    );

    if (node.getMergePolicy() !== undefined) {
      result[OBJECT_MERGE_POLICY] = node.getMergePolicy() as string;
    }
    if (value !== undefined && value !== null) {
      result[OBJECT_VALUE] = this.handleValue(value, valueTypeBlueId);
    }
    if (items !== undefined) {
      result[OBJECT_ITEMS] = items;
    }
    const schema = node.getSchema();
    if (schema !== undefined) {
      result[OBJECT_SCHEMA] = this.schemaToInput(
        schema,
        this.appendPath(path, OBJECT_SCHEMA),
        allowCyclicPlaceholders,
      );
    }
    if (node.getContractsNode() !== undefined) {
      result[OBJECT_CONTRACTS] = this.getNode(
        node.getContractsNode(),
        this.appendPath(path, OBJECT_CONTRACTS),
        'metadata',
        -1,
        allowCyclicPlaceholders,
      );
    }
    for (const [key, propertyValue] of Object.entries(
      node.getProperties() ?? {},
    )) {
      if (key === OBJECT_CONTRACTS) {
        continue;
      }
      result[key] = this.getNode(
        propertyValue,
        this.appendPath(path, key),
        'object-field',
        -1,
        allowCyclicPlaceholders,
      );
    }

    return result;
  }

  private static schemaToInput(
    schema: Schema,
    path: string,
    allowCyclicPlaceholders: boolean,
  ): BlueIdInputValue {
    const result: { [key: string]: BlueIdInputValue } = {};
    for (const [field, value] of schema.entries()) {
      result[field] = this.getNode(
        value,
        this.appendPath(path, field),
        'metadata',
        -1,
        allowCyclicPlaceholders,
      );
    }
    const enumValues = schema.getEnum();
    if (enumValues !== undefined) {
      result.enum = this.canonicalizeSchemaEnumValues(
        enumValues,
        this.appendPath(path, 'enum'),
        allowCyclicPlaceholders,
      ).map((value, index) =>
        this.getNode(
          value,
          this.appendPath(this.appendPath(path, 'enum'), String(index)),
          'metadata',
          -1,
          allowCyclicPlaceholders,
        ),
      );
    }
    return result;
  }

  private static canonicalizeSchemaEnumValues(
    enumValues: BlueNode[],
    path: string,
    allowCyclicPlaceholders: boolean,
  ): BlueNode[] {
    const uniqueByInput = new Map<string, BlueNode>();
    for (const enumValue of enumValues) {
      const comparable = enumValue.clone();
      comparable.setSchema(undefined);
      uniqueByInput.set(
        JSON.stringify(
          this.getNode(
            comparable,
            path,
            'metadata',
            -1,
            allowCyclicPlaceholders,
          ),
        ),
        enumValue,
      );
    }

    return [...uniqueByInput.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, enumValue]) => enumValue);
  }

  private static validateReferenceBlueId(
    blueId: string | undefined,
    path: string,
    allowCyclicPlaceholders: boolean,
  ): string {
    if (
      allowCyclicPlaceholders &&
      BlueIds.isCyclicCalculationPlaceholder(blueId)
    ) {
      return blueId as string;
    }
    return BlueIds.requireBlueIdOrCyclicMember(
      BlueIds.requireNoThisPlaceholderOutsideCyclicApi(blueId, path),
      path,
    );
  }

  private static validateBlueIdInput(
    node: BlueNode | undefined,
    path: string,
    context: Context,
    listIndex: number,
  ): asserts node is BlueNode {
    if (node === undefined) {
      throw new Error(
        `BlueId input must not contain null nodes. Path: ${path}`,
      );
    }
    if (
      context === 'metadata' &&
      this.isTypePosition(path) &&
      node.isInlineValue()
    ) {
      throw new Error(
        `Direct BlueId input must not contain unresolved type aliases. Path: ${path}`,
      );
    }
    if (node.getBlue() !== undefined) {
      throw new Error(
        `"blue" is a preprocessing directive and must not be present in BlueId input. Call preprocess/canonicalize/calculateSemanticBlueId first. Path: ${path}`,
      );
    }
    if (node.getPosition() !== undefined) {
      throw new Error(
        `"$pos" overlays are not valid direct BlueId input. Path: ${path}`,
      );
    }
    if (node.getProperties()?.[LIST_CONTROL_REPLACE] !== undefined) {
      throw new Error(
        `"$replace" overlays are not valid direct BlueId input. Path: ${path}`,
      );
    }
    if (context === 'list-element') {
      if (this.isEmptyNode(node)) {
        throw new Error(
          `Direct BlueId input must use { "$empty": true } for empty list placeholders. Path: ${path}`,
        );
      }
      if (node.getProperties()?.[LIST_CONTROL_EMPTY] !== undefined) {
        this.validateEmptyPlaceholder(node, path);
      }
      if (node.getPreviousBlueId() !== undefined && listIndex !== 0) {
        throw new Error(
          `"$previous" must appear only as the first list item. Path: ${path}`,
        );
      }
    } else if (node.getPreviousBlueId() !== undefined) {
      throw new Error(
        `"$previous" is valid only as the first list item in direct BlueId input. Path: ${path}`,
      );
    }
    this.validatePayloadKind(node, path);
  }

  private static validatePayloadKind(node: BlueNode, path: string): void {
    const propertyKeys = this.ordinaryPropertyKeys(node);
    const payloadKinds = [
      node.getValue() !== undefined && node.getValue() !== null,
      node.getItems() !== undefined,
      propertyKeys.length > 0,
    ].filter(Boolean).length;
    if (payloadKinds > 1) {
      throw new Error(
        `A Blue node may contain only one payload kind: value, items, or object fields. Path: ${path}`,
      );
    }
    if (
      node.getReferenceBlueId() !== undefined &&
      !this.isReferenceOnly(node)
    ) {
      throw new Error(
        `"blueId" nodes must be reference-only and cannot contain sibling fields. Path: ${path}`,
      );
    }
    if (
      node.getPreviousBlueId() !== undefined &&
      (payloadKinds > 0 ||
        node.getName() !== undefined ||
        node.getDescription() !== undefined ||
        node.getType() !== undefined ||
        node.getItemType() !== undefined ||
        node.getKeyType() !== undefined ||
        node.getValueType() !== undefined ||
        node.getSchema() !== undefined ||
        node.getMergePolicy() !== undefined ||
        node.getPosition() !== undefined ||
        node.getContractsNode() !== undefined ||
        node.getReferenceBlueId() !== undefined)
    ) {
      throw new Error(
        `"$previous" list anchors must be single-key list items. Path: ${path}`,
      );
    }
  }

  private static handleValue(
    value: NonNullable<ReturnType<BlueNode['getValue']>>,
    valueTypeBlueId: string | undefined,
  ): string | number | boolean {
    if (valueTypeBlueId === DOUBLE_TYPE_BLUE_ID) {
      return BlueNumbers.toCanonicalDoubleValue(value).toNumber();
    }
    if (value instanceof BigIntegerNumber || isBigIntegerNumber(value)) {
      if (value.lt(MIN_SAFE) || value.gt(MAX_SAFE)) {
        return value.toString();
      }
      return value.toNumber();
    }
    const maybeBig = value as unknown;
    if (maybeBig instanceof BigDecimalNumber || isBigNumber(maybeBig)) {
      return maybeBig.toNumber();
    }
    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }
    throw new Error(`Unsupported Blue scalar value: ${String(value)}`);
  }

  private static inferTypeBlueId(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return TEXT_TYPE_BLUE_ID;
    }
    if (value instanceof BigIntegerNumber || isBigIntegerNumber(value)) {
      return INTEGER_TYPE_BLUE_ID;
    }
    if (value instanceof BigDecimalNumber || isBigNumber(value)) {
      return DOUBLE_TYPE_BLUE_ID;
    }
    if (typeof value === 'boolean') {
      return BOOLEAN_TYPE_BLUE_ID;
    }
    return undefined;
  }

  private static setString(
    target: { [key: string]: BlueIdInputValue },
    key: string,
    value: string | undefined,
  ): void {
    if (value !== undefined) {
      target[key] = value;
    }
  }

  private static setNode(
    target: { [key: string]: BlueIdInputValue },
    key: string,
    node: BlueNode | undefined,
    path: string,
    allowCyclicPlaceholders: boolean,
  ): void {
    if (node !== undefined) {
      target[key] = this.getNode(
        node,
        this.appendPath(path, key),
        'metadata',
        -1,
        allowCyclicPlaceholders,
      );
    }
  }

  private static isReferenceOnly(node: BlueNode): boolean {
    return (
      node.getReferenceBlueId() !== undefined &&
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getValueType() === undefined &&
      (node.getValue() === undefined || node.getValue() === null) &&
      node.getItems() === undefined &&
      this.ordinaryPropertyKeys(node).length === 0 &&
      node.getContractsNode() === undefined &&
      node.getSchema() === undefined &&
      node.getMergePolicy() === undefined &&
      node.getPreviousBlueId() === undefined &&
      node.getPosition() === undefined &&
      node.getBlue() === undefined
    );
  }

  private static isPayloadOnlyList(node: BlueNode): boolean {
    return (
      node.getItems() !== undefined &&
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getValueType() === undefined &&
      (node.getValue() === undefined || node.getValue() === null) &&
      this.ordinaryPropertyKeys(node).length === 0 &&
      node.getContractsNode() === undefined &&
      node.getReferenceBlueId() === undefined &&
      node.getSchema() === undefined &&
      node.getMergePolicy() === undefined &&
      node.getPreviousBlueId() === undefined &&
      node.getPosition() === undefined &&
      node.getBlue() === undefined
    );
  }

  private static isEmptyNode(node: BlueNode): boolean {
    return (
      node.getName() === undefined &&
      node.getDescription() === undefined &&
      node.getType() === undefined &&
      node.getItemType() === undefined &&
      node.getKeyType() === undefined &&
      node.getValueType() === undefined &&
      (node.getValue() === undefined || node.getValue() === null) &&
      node.getItems() === undefined &&
      this.ordinaryPropertyKeys(node).length === 0 &&
      node.getContractsNode() === undefined &&
      node.getReferenceBlueId() === undefined &&
      node.getSchema() === undefined &&
      node.getMergePolicy() === undefined &&
      node.getPreviousBlueId() === undefined &&
      node.getPosition() === undefined &&
      node.getBlue() === undefined
    );
  }

  private static isEmptyPlaceholder(node: BlueNode): boolean {
    const properties = node.getProperties();
    const empty = properties?.[LIST_CONTROL_EMPTY];
    return (
      properties !== undefined &&
      Object.keys(properties).length === 1 &&
      empty !== undefined &&
      empty.getValue() === true &&
      empty.getItems() === undefined &&
      Object.keys(empty.getProperties() ?? {}).length === 0
    );
  }

  private static validateEmptyPlaceholder(node: BlueNode, path: string): void {
    if (!this.isEmptyPlaceholder(node)) {
      throw new Error(
        `"$empty" list placeholder must have exact shape { "$empty": true }. Path: ${path}`,
      );
    }
  }

  private static isTypePosition(path: string): boolean {
    return (
      path.endsWith(`/${OBJECT_TYPE}`) ||
      path.endsWith(`/${OBJECT_ITEM_TYPE}`) ||
      path.endsWith(`/${OBJECT_KEY_TYPE}`) ||
      path.endsWith(`/${OBJECT_VALUE_TYPE}`)
    );
  }

  private static appendPath(path: string, segment: string): string {
    const escaped = segment.replace(/~/g, '~0').replace(/\//g, '~1');
    return path === '/' ? `/${escaped}` : `${path}/${escaped}`;
  }

  private static ordinaryPropertyKeys(node: BlueNode): string[] {
    return Object.keys(node.getProperties() ?? {}).filter(
      (key) => key !== OBJECT_CONTRACTS,
    );
  }
}

export const blueIdInputToJson = (value: BlueIdInputValue): JsonBlueValue =>
  value as JsonBlueValue;
