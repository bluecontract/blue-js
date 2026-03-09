import type { BlueNode, JsonBlueValue } from '@blue-labs/language';
import { getTypeAliasByBlueId } from '@blue-repository/types';

import { INTERNAL_BLUE } from './internal/blue';

const TYPE_ALIAS_KEYS = new Set([
  'type',
  'itemType',
  'keyType',
  'valueType',
  'documentType',
  'targetDocumentType',
  'workerType',
]);

export function nodeToAliasJson(node: BlueNode): JsonBlueValue {
  const restored = INTERNAL_BLUE.restoreInlineTypes(node.clone());
  const simple = INTERNAL_BLUE.nodeToJson(restored, 'simple') as JsonBlueValue;
  return normalizeAliasJson(simple);
}

function normalizeAliasJson(
  value: JsonBlueValue,
  parentKey?: string,
): JsonBlueValue {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAliasJson(item)) as JsonBlueValue;
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  if (parentKey && TYPE_ALIAS_KEYS.has(parentKey)) {
    const alias = aliasFromBlueIdObject(value);
    if (alias) {
      return alias;
    }
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      normalizeAliasJson(entry as JsonBlueValue, key),
    ]),
  ) as JsonBlueValue;
}

function isPlainRecord(
  value: JsonBlueValue,
): value is Record<string, JsonBlueValue> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function aliasFromBlueIdObject(
  value: Record<string, JsonBlueValue>,
): string | null {
  const entries = Object.entries(value);
  if (entries.length !== 1 || entries[0]?.[0] !== 'blueId') {
    return null;
  }

  const blueId = entries[0][1];
  if (typeof blueId !== 'string') {
    return null;
  }

  return getTypeAliasByBlueId(blueId) ?? blueId;
}
