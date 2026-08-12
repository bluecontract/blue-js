import fastJsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import type { JsonValue } from '@blue-labs/shared-utils';
import { Alias, JsonMap } from './internalTypes';
import { PRIMITIVE_BLUE_IDS, PRIMITIVE_TYPES } from './constants';
import { isRecord } from './utils';
import {
  OBJECT_SCHEMA,
  parsePointer as parseRepositoryPointer,
  RESERVED_ATTRIBUTES_POINTER_SEGMENTS,
  validateAttributesAddedPointer,
} from '@blue-labs/repository-contract';

const RESERVED_TERMINAL_SEGMENTS = new Set([
  'type',
  'itemType',
  'valueType',
  'keyType',
]);
const ALLOWED_PRIMITIVE_ADDITIONS = new Set(['name', 'description']);

export const CHANGE_STATUS = {
  Unchanged: 'unchanged',
  NonBreaking: 'non-breaking',
  Breaking: 'breaking',
} as const;

export type ChangeStatus = (typeof CHANGE_STATUS)[keyof typeof CHANGE_STATUS];

export type ChangeClassification =
  | { status: typeof CHANGE_STATUS.Unchanged; attributesAdded: string[] }
  | { status: typeof CHANGE_STATUS.NonBreaking; attributesAdded: string[] }
  | { status: typeof CHANGE_STATUS.Breaking; attributesAdded: string[] };

export function classifyChange(
  previousContent: JsonMap,
  nextContent: JsonMap,
  packageName: string,
  typeName: string,
  blueIdAliases: Map<string, Set<Alias>>,
  sourceContent: JsonMap,
  previousExternalTypeBlueIdsByName: ReadonlyMap<string, string>,
  previousTypeBlueId?: string,
  nextTypeBlueId?: string,
): ChangeClassification {
  const patch = fastJsonPatch.compare(
    previousContent as unknown as Record<string, unknown>,
    nextContent as unknown as Record<string, unknown>,
  );

  if (patch.length === 0) {
    return { status: CHANGE_STATUS.Unchanged, attributesAdded: [] };
  }

  const attributesAdded: string[] = [];
  let dependencyUpdates = false;
  for (const op of patch) {
    if (isTypeBlueIdReplace(op, previousContent, blueIdAliases)) {
      dependencyUpdates = true;
      continue;
    }
    if (
      isCyclicRepositoryReferenceReplace(
        op,
        previousContent,
        sourceContent,
        blueIdAliases,
        previousTypeBlueId,
        nextTypeBlueId,
      )
    ) {
      dependencyUpdates = true;
      continue;
    }
    if (
      isExternalRegistryTypeBlueIdReplace(
        op,
        previousContent,
        sourceContent,
        blueIdAliases,
        previousExternalTypeBlueIdsByName,
      )
    ) {
      dependencyUpdates = true;
      continue;
    }

    if (op.op !== 'add') {
      return { status: CHANGE_STATUS.Breaking, attributesAdded: [] };
    }
    if (!isOptionalAddition(op)) {
      return { status: CHANGE_STATUS.Breaking, attributesAdded: [] };
    }
    attributesAdded.push(op.path);
  }

  if (attributesAdded.length === 0 && !dependencyUpdates) {
    return {
      status: CHANGE_STATUS.Breaking,
      attributesAdded: [],
    };
  }

  if (attributesAdded.length > 0) {
    validateAttributePointers(attributesAdded, packageName, typeName);
  }
  return { status: CHANGE_STATUS.NonBreaking, attributesAdded };
}

function isCyclicRepositoryReferenceReplace(
  op: Operation,
  previousContent: JsonMap,
  sourceContent: JsonMap,
  blueIdAliases: ReadonlyMap<string, Set<Alias>>,
  previousTypeBlueId?: string,
  nextTypeBlueId?: string,
): boolean {
  if (
    op.op !== 'replace' ||
    typeof op.path !== 'string' ||
    previousTypeBlueId === undefined ||
    nextTypeBlueId === undefined
  ) {
    return false;
  }
  const segments = safeParsePointer(op.path);
  if (segments.length < 2 || segments.at(-1) !== 'blueId') {
    return false;
  }
  const controlKey = segments.at(-2);
  if (!controlKey || !RESERVED_TERMINAL_SEGMENTS.has(controlKey)) {
    return false;
  }

  const sourceAlias = getValueAt(sourceContent, segments.slice(0, -1));
  if (typeof sourceAlias !== 'string' || PRIMITIVE_TYPES.has(sourceAlias)) {
    return false;
  }
  const previousIndex = readThisIndex(
    readBlueId(getValueAt(previousContent, segments)),
  );
  const nextIndex = readThisIndex(readBlueId(op.value as JsonValue));
  const previousMaster = readCyclicMaster(previousTypeBlueId);
  const nextMaster = readCyclicMaster(nextTypeBlueId);
  if (
    previousIndex === null ||
    nextIndex === null ||
    previousMaster === null ||
    nextMaster === null
  ) {
    return false;
  }

  const alias = sourceAlias as Alias;
  return (
    blueIdAliases.get(`${previousMaster}#${previousIndex}`)?.has(alias) ===
      true &&
    blueIdAliases.get(`${nextMaster}#${nextIndex}`)?.has(alias) === true
  );
}

function readThisIndex(blueId: string | null): number | null {
  const match = blueId?.match(/^this#(0|[1-9]\d*)$/u);
  return match ? Number(match[1]) : null;
}

function readCyclicMaster(blueId: string): string | null {
  const match = blueId.match(/^(.+)#(?:0|[1-9]\d*)$/u);
  return match?.[1] ?? null;
}

function validateAttributePointers(
  attributes: string[],
  packageName: string,
  typeName: string,
) {
  for (const attr of attributes) {
    try {
      validateAttributesAddedPointer(attr);
    } catch (err) {
      throw new Error(
        `Invalid attribute pointer "${attr}" for ${packageName}/${typeName}: ${(err as Error).message}`,
      );
    }
  }
}

function isOptionalAddition(op: Operation): boolean {
  if (op.op !== 'add') {
    return false;
  }

  const segments = safeParsePointer(op.path);
  if (segments.length === 0) {
    return false;
  }
  const last = segments.at(-1);
  if (last && /^\d+$/.test(last)) {
    return false;
  }

  if (last && RESERVED_TERMINAL_SEGMENTS.has(last)) {
    return false;
  }

  if (
    segments.some((segment) =>
      RESERVED_ATTRIBUTES_POINTER_SEGMENTS.has(segment),
    )
  ) {
    return false;
  }

  if (!isRecord(op.value)) {
    return last ? ALLOWED_PRIMITIVE_ADDITIONS.has(last) : false;
  }

  if (introducesRequiredField(op.value)) {
    return false;
  }

  return true;
}

function safeParsePointer(pointer: string): string[] {
  try {
    return parseRepositoryPointer(pointer);
  } catch {
    return [];
  }
}

function introducesRequiredField(value: Record<string, unknown>): boolean {
  const stack: Record<string, unknown>[] = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(current, 'value')) {
      return true;
    }

    if (Object.prototype.hasOwnProperty.call(current, 'items')) {
      return true;
    }

    if (Object.prototype.hasOwnProperty.call(current, OBJECT_SCHEMA)) {
      const schema = current[OBJECT_SCHEMA];
      if (isRecord(schema) && schema.required === true) {
        return true;
      }
    }

    for (const [key, val] of Object.entries(current)) {
      if (key === OBJECT_SCHEMA) {
        continue;
      }
      if (isRecord(val)) {
        stack.push(val);
      }
    }
  }
  return false;
}

function isTypeBlueIdReplace(
  op: Operation,
  previousContent: JsonMap,
  blueIdAliases: Map<string, Set<Alias>>,
): boolean {
  if (op.op !== 'replace' || typeof op.path !== 'string') {
    return false;
  }
  const segments = safeParsePointer(op.path);
  if (segments.length < 2) {
    return false;
  }
  const last = segments.at(-1);
  const prev = segments.at(-2);
  if (
    !(
      last === 'blueId' &&
      prev !== undefined &&
      (prev === 'type' ||
        prev === 'itemType' ||
        prev === 'keyType' ||
        prev === 'valueType')
    )
  ) {
    return false;
  }

  const previousValue = getValueAt(previousContent, segments);
  const previousBlueId =
    typeof previousValue === 'string'
      ? previousValue
      : isRecord(previousValue) && typeof previousValue.blueId === 'string'
        ? previousValue.blueId
        : null;
  const nextBlueId =
    typeof op.value === 'string'
      ? op.value
      : isRecord(op.value) && typeof op.value.blueId === 'string'
        ? op.value.blueId
        : null;

  if (!previousBlueId || !nextBlueId) {
    return false;
  }

  const previousAliases = blueIdAliases.get(previousBlueId);
  const nextAliases = blueIdAliases.get(nextBlueId);
  if (!previousAliases || !nextAliases) {
    return false;
  }

  for (const alias of previousAliases) {
    if (nextAliases.has(alias)) {
      return true;
    }
  }

  return false;
}

function isExternalRegistryTypeBlueIdReplace(
  op: Operation,
  previousContent: JsonMap,
  sourceContent: JsonMap,
  blueIdAliases: ReadonlyMap<string, Set<Alias>>,
  previousExternalTypeBlueIdsByName: ReadonlyMap<string, string>,
): boolean {
  if (op.op !== 'replace' || typeof op.path !== 'string') {
    return false;
  }
  const segments = safeParsePointer(op.path);
  if (segments.length < 2 || segments.at(-1) !== 'blueId') {
    return false;
  }
  const controlKey = segments.at(-2);
  if (!controlKey || !RESERVED_TERMINAL_SEGMENTS.has(controlKey)) {
    return false;
  }

  const sourceTypeName = getValueAt(sourceContent, segments.slice(0, -1));
  if (
    typeof sourceTypeName !== 'string' ||
    !PRIMITIVE_TYPES.has(sourceTypeName)
  ) {
    return false;
  }
  const previousBlueId = readBlueId(getValueAt(previousContent, segments));
  const nextBlueId = readBlueId(op.value as JsonValue);
  return (
    previousBlueId !== null &&
    nextBlueId !== null &&
    !blueIdAliases.has(previousBlueId) &&
    previousExternalTypeBlueIdsByName.get(sourceTypeName) === previousBlueId &&
    PRIMITIVE_BLUE_IDS[sourceTypeName] === nextBlueId
  );
}

function readBlueId(value: JsonValue | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return isRecord(value) && typeof value.blueId === 'string'
    ? value.blueId
    : null;
}

function getValueAt(
  content: JsonValue,
  segments: string[],
): JsonValue | undefined {
  let current: JsonValue = content;
  for (const seg of segments) {
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (Number.isNaN(idx) || idx < 0 || idx >= current.length) {
        return undefined;
      }
      current = current[idx] as JsonValue;
    } else if (isRecord(current)) {
      current = current[seg] as JsonValue;
    } else {
      return undefined;
    }
  }
  return current;
}
