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
  BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP,
  CORE_TYPE_BLUE_IDS,
  DICTIONARY_TYPE_BLUE_ID,
  DOUBLE_TYPE_BLUE_ID,
  INTEGER_TYPE_BLUE_ID,
  LIST_TYPE_BLUE_ID,
  OBJECT_BLUE_ID,
  OBJECT_ITEMS,
  OBJECT_SCHEMA,
  OBJECT_TYPE,
  OBJECT_VALUE,
  OBJECT_ITEM_TYPE,
  OBJECT_KEY_TYPE,
  OBJECT_VALUE_TYPE,
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
const TYPE_CONTROL_KEYS = [
  OBJECT_TYPE,
  OBJECT_ITEM_TYPE,
  OBJECT_KEY_TYPE,
  OBJECT_VALUE_TYPE,
] as const;
const LEGACY_CORE_TYPE_BLUE_IDS = new Map([
  ['DLRQwz7MQeCrzjy9bohPNwtCxKEBbKaMK65KBrwjfG6K', TEXT_TYPE_BLUE_ID],
  ['7pwXmXYCJtWnd348c2JQGBkm9C4renmZRwxbfaypsx5y', DOUBLE_TYPE_BLUE_ID],
  ['5WNMiV9Knz63B4dVY5JtMyh3FB4FSGqv7ceScvuapdE1', INTEGER_TYPE_BLUE_ID],
  ['4EzhSubEimSQD3zrYHRtobfPPWntUuhEz8YcdxHsi12u', BOOLEAN_TYPE_BLUE_ID],
  ['6aehfNAxHLC1PHHoDr3tYtFH3RWNbiWdFancJ1bypXEY', LIST_TYPE_BLUE_ID],
  ['G7fBT9PSod1RfHLHkpafAGBDVAJMrMhAMY51ERcyXNrj', DICTIONARY_TYPE_BLUE_ID],
]);
const LEGACY_BLUE_CONTRACTS_RUNTIME_TYPE_BLUE_IDS = new Map([
  [
    'AERp8BWnuUsjoPciAeNXuUWS9fmqPNMdWbxmKn3tcitx',
    BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP.Contract,
  ],
  [
    'Bz49DbfqKC1yJeCfv5RYPZUKTfb7rtZnmreCaz4RsXn5',
    BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP['Json Patch Entry'],
  ],
  [
    'DcoJyCh7XXxy1nR5xjy7qfkUgQ1GiZnKKSxh8DJusBSr',
    BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP.Channel,
  ],
  [
    '9ZE5pGjtSGJgWJG7iAVz4iPEz5CatceX3yb3qp5MpAKJ',
    BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP.Handler,
  ],
  [
    '7QACj919YMRvFCTELCf6jfQTp41RVhtHdE6bPazLUZQ6',
    BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP.Marker,
  ],
  [
    'BrpmpNt5JkapeUvPqYcxgXZrHNZX3R757dRwuXXdfNM2',
    BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP[
      'Document Processing Initiated'
    ],
  ],
  [
    'C77W4kVGcxL7Mkx9WL9QESPEFFL2GzWAe647s1Efprt',
    BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP['Triggered Event Channel'],
  ],
  [
    'H2aCCTUcLMTJozWkn7HPUjyFBFxamraw1q8DyWk87zxr',
    BLUE_CONTRACTS_RUNTIME_TYPE_NAME_TO_BLUE_ID_MAP['Lifecycle Event Channel'],
  ],
]);
const LEGACY_DEFAULT_BLUE_TYPE_BLUE_IDS = new Map([
  ...LEGACY_CORE_TYPE_BLUE_IDS,
  ...LEGACY_BLUE_CONTRACTS_RUNTIME_TYPE_BLUE_IDS,
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
      LEGACY_DEFAULT_BLUE_TYPE_BLUE_IDS.get(blueId) ?? blueId;
  }

  for (const key of TYPE_CONTROL_KEYS) {
    const child = normalized[key];
    if (child !== undefined) {
      normalized[key] = normalizeTypeControlKeyword(child);
    }
  }

  const legacyExpression = normalizeRepositoryLegacyExpression(normalized);
  if (legacyExpression !== undefined) {
    return legacyExpression;
  }

  const schema = normalized[OBJECT_SCHEMA];
  if (isJsonBlueObject(schema)) {
    normalized[OBJECT_SCHEMA] = normalizeSchemaObject(schema);
  }

  return normalized;
}

function normalizeRepositoryLegacyExpression(
  value: JsonBlueObject,
): JsonBlueObject | undefined {
  if (!isTextValueNode(value)) {
    return undefined;
  }

  const expression = value[OBJECT_VALUE];
  return typeof expression === 'string'
    ? legacyExpressionToBex(expression)
    : undefined;
}

function isTextValueNode(value: JsonBlueObject): boolean {
  const type = value[OBJECT_TYPE];
  return (
    isJsonBlueObject(type) &&
    type[OBJECT_BLUE_ID] === TEXT_TYPE_BLUE_ID &&
    typeof value[OBJECT_VALUE] === 'string'
  );
}

function legacyExpressionToBex(expression: string): JsonBlueObject | undefined {
  const trimmed = expression.trim();
  const wrapped = trimmed.match(/^\$\{\s*(.*)\s*\}$/u);
  if (!wrapped) {
    return undefined;
  }

  const body = wrapped[1].trim();
  const documentMatch = body.match(/^document\(['"]([^'"]+)['"]\)$/u);
  if (documentMatch) {
    return { $document: normalizePointer(documentMatch[1]) };
  }

  if (body === 'event') {
    return { $event: '/' };
  }
  if (body.startsWith('event.')) {
    return { $event: dottedPathToPointer(body.slice('event.'.length)) };
  }

  if (body === 'currentContract') {
    return { $currentContract: '/' };
  }
  if (body.startsWith('currentContract.')) {
    return {
      $currentContract: dottedPathToPointer(
        body.slice('currentContract.'.length),
      ),
    };
  }

  if (body.startsWith('steps.')) {
    return { $steps: body.slice('steps.'.length) };
  }

  return undefined;
}

function normalizePointer(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function dottedPathToPointer(path: string): string {
  return normalizePointer(
    path
      .split('.')
      .map((part) => part.replace(/~/gu, '~0').replace(/\//gu, '~1'))
      .join('/'),
  );
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

function normalizeTypeControlKeyword(value: JsonBlueValue): JsonBlueValue {
  if (!isJsonBlueObject(value)) {
    return value;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return value;
  }

  const typeNode = value[OBJECT_TYPE];
  if (!isJsonBlueObject(typeNode)) {
    return value;
  }

  const blueId = typeNode[OBJECT_BLUE_ID];
  if (typeof blueId !== 'string') {
    return value;
  }

  const currentBlueId = LEGACY_DEFAULT_BLUE_TYPE_BLUE_IDS.get(blueId) ?? blueId;
  if (
    !CORE_TYPE_BLUE_IDS.includes(
      currentBlueId as (typeof CORE_TYPE_BLUE_IDS)[number],
    )
  ) {
    return value;
  }

  return { [OBJECT_BLUE_ID]: currentBlueId };
}
