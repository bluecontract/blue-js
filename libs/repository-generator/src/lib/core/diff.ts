import fastJsonPatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import { JsonBlueValue } from '@blue-labs/language';
import { JsonMap } from './internalTypes';
import { PRIMITIVE_BLUE_IDS } from './constants';
import { isRecord } from './utils';
import {
  parsePointer as parseRepositoryPointer,
  validateAttributesAddedPointer,
} from '@blue-labs/repository-contract';

const PRIMITIVE_BLUE_ID_SET = new Set(Object.values(PRIMITIVE_BLUE_IDS));

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
    if (isTypeBlueIdReplace(op, previousContent)) {
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

  if (!isRecord(op.value)) {
    return false;
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

    if (
      Object.prototype.hasOwnProperty.call(current, 'schema') &&
      isRecord(current.schema) &&
      current.schema.required === true
    ) {
      return true;
    }

    for (const [key, val] of Object.entries(current)) {
      if (key === 'schema') {
        continue;
      }
      if (isRecord(val)) {
        stack.push(val);
      }
    }
  }
  return false;
}

function isTypeBlueIdReplace(op: Operation, previousContent: JsonMap): boolean {
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

  if (
    (previousBlueId && PRIMITIVE_BLUE_ID_SET.has(previousBlueId)) ||
    (nextBlueId && PRIMITIVE_BLUE_ID_SET.has(nextBlueId))
  ) {
    return false;
  }

  return true;
}

function getValueAt(
  content: JsonBlueValue,
  segments: string[],
): JsonBlueValue | undefined {
  let current: JsonBlueValue = content;
  for (const seg of segments) {
    if (Array.isArray(current)) {
      const idx = Number(seg);
      if (Number.isNaN(idx) || idx < 0 || idx >= current.length) {
        return undefined;
      }
      current = current[idx] as JsonBlueValue;
    } else if (isRecord(current)) {
      current = current[seg] as JsonBlueValue;
    } else {
      return undefined;
    }
  }
  return current;
}
