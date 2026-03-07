import { BlueNode, isJsonBlueValue } from '@blue-labs/language';

import type { BlueValueInput } from '../types';
import { INTERNAL_BLUE } from './blue';
import { resolveTypeInput } from './type-input';

export function toBlueNode(value: BlueValueInput): BlueNode {
  if (value instanceof BlueNode) {
    return normalizeBlueNodeInput(value);
  }

  if (isJsonBlueValue(value)) {
    return INTERNAL_BLUE.jsonValueToNode(value);
  }

  throw new Error('Unsupported BLUE value input');
}

export function toRequestSchemaNode(value: BlueValueInput): BlueNode {
  if (value instanceof BlueNode) {
    return normalizeBlueNodeInput(value);
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return new BlueNode().setValue(value);
  }

  if (Array.isArray(value)) {
    return new BlueNode().setItems(
      value.map((item) => toRequestSchemaNode(item)),
    );
  }

  if (isJsonBlueValue(value)) {
    return fromRequestSchemaRecord(value as Record<string, unknown>);
  }

  throw new Error('Unsupported BLUE value input');
}

export function normalizeBlueNodeInput(node: BlueNode): BlueNode {
  return node.clone();
}

function fromRequestSchemaRecord(record: Record<string, unknown>): BlueNode {
  const node = new BlueNode();

  if ('type' in record && record.type != null) {
    node.setType(
      resolveTypeInput(record.type as Parameters<typeof resolveTypeInput>[0]),
    );
  }

  if ('blueId' in record && typeof record.blueId === 'string') {
    node.setBlueId(record.blueId.trim());
  }

  for (const [key, propertyValue] of Object.entries(record)) {
    if (key === 'type' || key === 'blueId') {
      continue;
    }

    node.addProperty(key, toRequestSchemaNode(propertyValue as BlueValueInput));
  }

  return node;
}
