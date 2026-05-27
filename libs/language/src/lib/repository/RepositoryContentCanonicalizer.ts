import {
  isJsonBlueObject,
  type JsonBlueObject,
  type JsonBlueValue,
} from '../../schema';
import { CyclicSetIdentityService } from '../identity/CyclicSetIdentityService';
import { BlueNode, NodeDeserializer } from '../model';
import { NodeToMapListOrValue } from '../utils/NodeToMapListOrValue';
import {
  BOOLEAN_TYPE_BLUE_ID,
  DICTIONARY_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  OBJECT_BLUE_ID,
  OBJECT_ITEMS,
  OBJECT_SCHEMA,
  OBJECT_VALUE,
  TEXT_TYPE_BLUE_ID,
} from '../utils/Properties';

const BOOLEAN_SCHEMA_KEYS = new Set(['required', 'uniqueItems']);
const NON_NEGATIVE_INTEGER_SCHEMA_KEYS = new Set([
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minFields',
  'maxFields',
]);
const LEGACY_CORE_TYPE_BLUE_IDS = new Map([
  ['DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K', TEXT_TYPE_BLUE_ID],
  ['7pwXmXYCJtWnd348c2JQGBkm9C4renmZRwxbfaypsx5y', DOUBLE_TYPE_BLUE_ID],
  ['5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1', INTEGER_TYPE_BLUE_ID],
  ['4EzhSubEimSQD3zrYHRtobfPPWntUuhEz8YcdxHsi12u', BOOLEAN_TYPE_BLUE_ID],
  ['6aehfNAxHLC1PHHoDr3tYtFH3RWNbiWdFancJ1bypXEY', LIST_TYPE_BLUE_ID],
  ['G7fBT9PSod1RfHLHkpafAGBDVAJMrMhAMY51ERcyXNrj', DICTIONARY_TYPE_BLUE_ID],
]);

export function canonicalizeRepositoryContent(
  content: JsonBlueValue,
): JsonBlueValue {
  const normalizedContent = normalizeRepositoryGeneratedSchemaSyntax(content);
  if (!Array.isArray(normalizedContent)) {
    return normalizedContent;
  }

  return canonicalizeRepositoryDocumentList(normalizedContent);
}

export function canonicalizeRepositoryDocumentList(
  content: JsonBlueValue[],
): JsonBlueValue[] {
  const nodes = content.map((item) => NodeDeserializer.deserialize(item));

  if (!CyclicSetIdentityService.hasIndexedThisReference(nodes)) {
    return content;
  }

  return canonicalizeRepositoryNodeList(nodes);
}

function canonicalizeRepositoryNodeList(nodes: BlueNode[]): JsonBlueValue[] {
  const cyclicSet = new CyclicSetIdentityService().calculate(nodes);
  return cyclicSet.nodes.map((node) =>
    normalizeRepositoryGeneratedSchemaSyntax(NodeToMapListOrValue.get(node)),
  );
}

function normalizeRepositoryGeneratedSchemaSyntax(
  value: JsonBlueValue,
): JsonBlueValue {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeRepositoryGeneratedSchemaSyntax(item));
  }
  if (!isJsonBlueObject(value)) {
    return value;
  }

  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      normalizeRepositoryGeneratedSchemaSyntax(child),
    ]),
  ) as JsonBlueObject;
  const blueId = normalized[OBJECT_BLUE_ID];
  if (typeof blueId === 'string') {
    normalized[OBJECT_BLUE_ID] =
      LEGACY_CORE_TYPE_BLUE_IDS.get(blueId) ?? blueId;
  }

  const schema = normalized[OBJECT_SCHEMA];
  if (isJsonBlueObject(schema)) {
    normalized[OBJECT_SCHEMA] = normalizeSchemaObject(schema);
  }

  return normalized;
}

function normalizeSchemaObject(schema: JsonBlueObject): JsonBlueObject {
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [
      key,
      normalizeSchemaKeyword(key, value),
    ]),
  );
}

function normalizeSchemaKeyword(
  key: string,
  value: JsonBlueValue,
): JsonBlueValue {
  if (key === 'enum' && isJsonBlueObject(value)) {
    const items = value[OBJECT_ITEMS];
    if (Array.isArray(items)) {
      return items;
    }
  }
  if (
    (BOOLEAN_SCHEMA_KEYS.has(key) ||
      NON_NEGATIVE_INTEGER_SCHEMA_KEYS.has(key)) &&
    isJsonBlueObject(value) &&
    Object.prototype.hasOwnProperty.call(value, OBJECT_VALUE)
  ) {
    return value[OBJECT_VALUE];
  }
  return value;
}
