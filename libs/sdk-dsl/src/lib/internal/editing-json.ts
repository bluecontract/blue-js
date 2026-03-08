import { BlueNode } from '@blue-labs/language';

import type {
  DocPatchOperation,
  EditingJsonObject,
  EditingJsonValue,
} from '../editing/types';
import { INTERNAL_BLUE } from './blue';
import {
  isArrayIndexSegment,
  normalizeRequiredPointer,
  splitPointerSegments,
} from './pointer';

const NODE_ENVELOPE_KEY = '$sdkDslNode';
const ITEMS_ENVELOPE_KEY = '$sdkDslItems';

type NodeEnvelope = {
  name?: string;
  description?: string;
  type?: EditingJsonValue;
  itemType?: EditingJsonValue;
  keyType?: EditingJsonValue;
  valueType?: EditingJsonValue;
  blueId?: string;
  blue?: EditingJsonValue;
  value?: string | number | boolean | null;
  inlineValue?: boolean;
};

export function blueNodeToEditingJson(node: BlueNode): EditingJsonValue {
  return serializeNode(node.clone());
}

export function editingJsonToBlueNode(json: EditingJsonValue): BlueNode {
  return deserializeNode(cloneEditingJson(json));
}

export function cloneEditingJson(value: EditingJsonValue): EditingJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneEditingJson(item));
  }

  if (isEditingObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        cloneEditingJson(entryValue),
      ]),
    );
  }

  return value;
}

export function isEditingObject(
  value: EditingJsonValue | undefined,
): value is EditingJsonObject {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function isEditingPrimitive(
  value: EditingJsonValue | undefined,
): value is string | number | boolean | null {
  return value == null || typeof value !== 'object';
}

export function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function joinPointer(base: string, segment: string): string {
  const escaped = escapePointerSegment(segment);
  return base.length === 0 ? `/${escaped}` : `${base}/${escaped}`;
}

export function applyPatchOperations(
  root: EditingJsonValue,
  operations: readonly DocPatchOperation[],
): EditingJsonValue {
  let current = cloneEditingJson(root);
  for (const operation of operations) {
    current = applyPatchOperation(current, operation);
  }
  return current;
}

export function applyPatchOperation(
  root: EditingJsonValue,
  operation: DocPatchOperation,
): EditingJsonValue {
  const normalized = normalizeRequiredPointer(operation.path, 'path');
  if (normalized === '/') {
    if (operation.op === 'remove') {
      throw new Error('DocPatch cannot remove the root node');
    }
    return cloneEditingJson(operation.value as EditingJsonValue);
  }

  const segments = splitPointerSegments(normalized);
  const nextRoot = cloneEditingJson(root);
  applyPatchOperationInPlace(nextRoot, segments, operation, normalized);
  return nextRoot;
}

function applyPatchOperationInPlace(
  current: EditingJsonValue,
  segments: readonly string[],
  operation: DocPatchOperation,
  fullPath: string,
): void {
  if (segments.length === 0) {
    throw new Error(`Internal patch error for path: ${fullPath}`);
  }

  const leaf = segments[segments.length - 1] as string;
  const parents = segments.slice(0, -1);
  let cursor = current;

  for (const [index, segment] of parents.entries()) {
    const nextSegment = segments[index + 1] as string;
    if (Array.isArray(cursor)) {
      const arrayIndex = parseArrayIndexOrThrow(segment, fullPath);
      while (cursor.length <= arrayIndex) {
        cursor.push(createContainerForSegment(nextSegment));
      }

      const next = cursor[arrayIndex];
      if (!next || isEditingPrimitive(next)) {
        cursor[arrayIndex] = createContainerForSegment(nextSegment);
      }
      cursor = cursor[arrayIndex] as EditingJsonValue;
      continue;
    }

    if (!isEditingObject(cursor)) {
      throw new Error(
        `Cannot descend into primitive value at path: ${fullPath}`,
      );
    }

    const next = cursor[segment];
    if (next == null || isEditingPrimitive(next)) {
      cursor[segment] = createContainerForSegment(nextSegment);
    }
    cursor = cursor[segment] as EditingJsonValue;
  }

  if (Array.isArray(cursor)) {
    const arrayIndex = parseArrayIndexOrThrow(leaf, fullPath);
    if (operation.op === 'remove') {
      if (arrayIndex < cursor.length) {
        cursor.splice(arrayIndex, 1);
      }
      return;
    }

    while (cursor.length < arrayIndex) {
      cursor.push(null);
    }

    if (operation.op === 'add' && arrayIndex === cursor.length) {
      cursor.push(cloneEditingJson(operation.value as EditingJsonValue));
      return;
    }

    cursor[arrayIndex] = cloneEditingJson(operation.value as EditingJsonValue);
    return;
  }

  if (!isEditingObject(cursor)) {
    throw new Error(`Cannot write into primitive value at path: ${fullPath}`);
  }

  if (operation.op === 'remove') {
    delete cursor[leaf];
    return;
  }

  cursor[leaf] = cloneEditingJson(operation.value as EditingJsonValue);
}

function createContainerForSegment(nextSegment: string): EditingJsonValue {
  return isArrayIndexSegment(nextSegment) ? [] : {};
}

function parseArrayIndexOrThrow(segment: string, fullPath: string): number {
  if (!isArrayIndexSegment(segment)) {
    throw new Error(`Expected numeric array segment in path: ${fullPath}`);
  }
  return Number.parseInt(segment, 10);
}

function serializeNode(node: BlueNode): EditingJsonValue {
  if (isPlainScalarNode(node)) {
    return serializePrimitiveValue(node.getValue());
  }

  if (isPlainArrayNode(node)) {
    return (node.getItems() ?? []).map((item) => serializeNode(item));
  }

  if (isPlainObjectNode(node)) {
    return serializeProperties(node);
  }

  const envelope: NodeEnvelope = {};
  if (node.getName() != null) {
    envelope.name = node.getName();
  }
  if (node.getDescription() != null) {
    envelope.description = node.getDescription();
  }
  if (node.getType()) {
    envelope.type = serializeTypeNode(node.getType() as BlueNode);
  }
  if (node.getItemType()) {
    envelope.itemType = serializeTypeNode(node.getItemType() as BlueNode);
  }
  if (node.getKeyType()) {
    envelope.keyType = serializeTypeNode(node.getKeyType() as BlueNode);
  }
  if (node.getValueType()) {
    envelope.valueType = serializeTypeNode(node.getValueType() as BlueNode);
  }
  if (node.getBlueId() != null) {
    envelope.blueId = node.getBlueId();
  }
  if (node.getBlue()) {
    envelope.blue = serializeNode(node.getBlue() as BlueNode);
  }
  if (node.getValue() !== undefined) {
    envelope.value = serializePrimitiveValue(node.getValue());
  }
  if (node.isInlineValue()) {
    envelope.inlineValue = true;
  }

  const output: Record<string, EditingJsonValue> = {
    [NODE_ENVELOPE_KEY]: envelope,
  };

  if (node.getItems()) {
    output[ITEMS_ENVELOPE_KEY] = (node.getItems() ?? []).map((item) =>
      serializeNode(item),
    );
  }

  for (const [key, value] of Object.entries(node.getProperties() ?? {})) {
    output[key] = serializeNode(value);
  }

  return output;
}

function deserializeNode(value: EditingJsonValue): BlueNode {
  if (Array.isArray(value)) {
    return new BlueNode().setItems(value.map((item) => deserializeNode(item)));
  }

  if (!isEditingObject(value)) {
    return new BlueNode().setValue(value);
  }

  if (!isEnvelopeObject(value)) {
    return new BlueNode().setProperties(deserializeProperties(value));
  }

  const output = new BlueNode();
  const metadata = value[NODE_ENVELOPE_KEY] as EditingJsonObject | undefined;
  if (metadata) {
    if (typeof metadata.name === 'string') {
      output.setName(metadata.name);
    }
    if (typeof metadata.description === 'string') {
      output.setDescription(metadata.description);
    }
    if (metadata.type !== undefined) {
      output.setType(deserializeTypeNode(metadata.type));
    }
    if (metadata.itemType !== undefined) {
      output.setItemType(deserializeTypeNode(metadata.itemType));
    }
    if (metadata.keyType !== undefined) {
      output.setKeyType(deserializeTypeNode(metadata.keyType));
    }
    if (metadata.valueType !== undefined) {
      output.setValueType(deserializeTypeNode(metadata.valueType));
    }
    if (typeof metadata.blueId === 'string') {
      output.setBlueId(metadata.blueId);
    }
    if (metadata.blue !== undefined) {
      output.setBlue(deserializeNode(metadata.blue));
    }
    if ('value' in metadata) {
      output.setValue(metadata.value as string | number | boolean | null);
    }
    if (metadata.inlineValue === true) {
      output.setInlineValue(true);
    }
  }

  const items = value[ITEMS_ENVELOPE_KEY];
  if (Array.isArray(items)) {
    output.setItems(items.map((item) => deserializeNode(item)));
  }

  const properties = Object.entries(value)
    .filter(([key]) => key !== NODE_ENVELOPE_KEY && key !== ITEMS_ENVELOPE_KEY)
    .map(([key, entryValue]) => [key, deserializeNode(entryValue)] as const);
  if (properties.length > 0) {
    output.setProperties(Object.fromEntries(properties));
  }

  return output;
}

function serializeProperties(node: BlueNode): EditingJsonObject {
  return Object.fromEntries(
    Object.entries(node.getProperties() ?? {}).map(([key, value]) => [
      key,
      serializeNode(value),
    ]),
  );
}

function deserializeProperties(
  value: EditingJsonObject,
): Record<string, BlueNode> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      deserializeNode(entryValue),
    ]),
  );
}

function serializeTypeNode(node: BlueNode): EditingJsonValue {
  const restored = INTERNAL_BLUE.restoreInlineTypes(
    new BlueNode().setType(node.clone()),
  ).getType();
  const inlineAlias = restored?.getValue();
  if (typeof inlineAlias === 'string' && inlineAlias.length > 0) {
    return inlineAlias;
  }

  const value = node.getValue();
  if (typeof value === 'string' && isTypeNodeShape(node)) {
    return value;
  }

  const blueId = node.getBlueId();
  if (blueId != null && isTypeNodeShape(node)) {
    return { blueId };
  }

  return serializeNode(node);
}

function deserializeTypeNode(value: EditingJsonValue): BlueNode {
  if (typeof value === 'string') {
    return new BlueNode().setValue(value).setInlineValue(true);
  }

  if (
    isEditingObject(value) &&
    Object.keys(value).length === 1 &&
    typeof value.blueId === 'string'
  ) {
    return new BlueNode().setBlueId(value.blueId);
  }

  return deserializeNode(value);
}

function isPlainScalarNode(node: BlueNode): boolean {
  return !hasMetadata(node) && node.getValue() !== undefined;
}

function isPlainArrayNode(node: BlueNode): boolean {
  return !hasMetadata(node) && !!node.getItems();
}

function isPlainObjectNode(node: BlueNode): boolean {
  return !hasMetadata(node) && !!node.getProperties();
}

function hasMetadata(node: BlueNode): boolean {
  return (
    node.getName() != null ||
    node.getDescription() != null ||
    node.getType() != null ||
    node.getItemType() != null ||
    node.getKeyType() != null ||
    node.getValueType() != null ||
    node.getBlueId() != null ||
    node.getBlue() != null ||
    node.isInlineValue()
  );
}

function isTypeNodeShape(node: BlueNode): boolean {
  return (
    node.getName() == null &&
    node.getDescription() == null &&
    node.getItemType() == null &&
    node.getKeyType() == null &&
    node.getValueType() == null &&
    node.getBlue() == null &&
    node.getItems() == null &&
    node.getProperties() == null
  );
}

function serializePrimitiveValue(
  value: unknown,
): string | number | boolean | null {
  if (value == null) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'object' && value != null && 'toString' in value) {
    const stringValue = String(value);
    const numberValue = Number(stringValue);
    return Number.isFinite(numberValue) && stringValue.trim() !== ''
      ? numberValue
      : stringValue;
  }

  return String(value);
}

function isEnvelopeObject(value: EditingJsonObject): boolean {
  return NODE_ENVELOPE_KEY in value || ITEMS_ENVELOPE_KEY in value;
}
