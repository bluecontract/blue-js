import type { JsonObject, JsonValue, PointerWriteOptions } from './types.js';

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePointer(pointer: string): string {
  const trimmed = pointer.trim();
  if (trimmed.length === 0) {
    throw new Error('Pointer cannot be empty');
  }
  if (!trimmed.startsWith('/')) {
    throw new Error(`Pointer must start with '/': ${trimmed}`);
  }
  return trimmed;
}

function parseArrayIndex(segment: string): number {
  if (!/^\d+$/.test(segment)) {
    throw new Error(`Expected numeric array segment but got '${segment}'`);
  }
  return Number.parseInt(segment, 10);
}

function splitSegments(pointer: string): string[] {
  const normalized = normalizePointer(pointer);
  if (normalized === '/') {
    return [];
  }
  return normalized.split('/').slice(1);
}

function ensureObjectChild(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (isJsonObject(current)) {
    return current;
  }
  const created: JsonObject = {};
  parent[key] = created;
  return created;
}

function ensureArrayChild(parent: JsonObject, key: string): JsonValue[] {
  const current = parent[key];
  if (Array.isArray(current)) {
    return current;
  }
  const created: JsonValue[] = [];
  parent[key] = created;
  return created;
}

function ensureArrayIndex(
  array: JsonValue[],
  index: number,
  nextSegment?: string,
): JsonObject {
  while (array.length <= index) {
    array.push(nextSegment && /^\d+$/.test(nextSegment) ? [] : {});
  }
  const current = array[index];
  if (isJsonObject(current)) {
    return current;
  }
  if (Array.isArray(current)) {
    throw new Error(
      'Array-in-array traversal is not supported for object hops',
    );
  }
  const created: JsonObject = {};
  array[index] = created;
  return created;
}

export function setPointer(
  root: JsonObject,
  pointer: string,
  value: JsonValue,
  options: PointerWriteOptions = {},
): void {
  const { createMissing = true } = options;
  const segments = splitSegments(pointer);
  if (segments.length === 0) {
    throw new Error('Pointer cannot target document root');
  }

  let currentObject: JsonObject = root;
  let currentArray: JsonValue[] | null = null;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] as string;
    const next = segments[index + 1] as string;
    const nextIsArray = /^\d+$/.test(next);

    if (currentArray) {
      const arrayIndex = parseArrayIndex(segment);
      if (!createMissing && arrayIndex >= currentArray.length) {
        throw new Error(
          `Array index out of bounds while traversing: ${segment}`,
        );
      }
      currentObject = ensureArrayIndex(currentArray, arrayIndex, next);
      currentArray = null;
      continue;
    }

    const child = currentObject[segment];
    if (nextIsArray) {
      if (!createMissing && !Array.isArray(child)) {
        throw new Error(`Missing array segment '${segment}'`);
      }
      currentArray = ensureArrayChild(currentObject, segment);
      continue;
    }

    if (!createMissing && !isJsonObject(child)) {
      throw new Error(`Missing object segment '${segment}'`);
    }
    currentObject = ensureObjectChild(currentObject, segment);
  }

  const leaf = segments[segments.length - 1] as string;
  if (currentArray) {
    const arrayIndex = parseArrayIndex(leaf);
    while (currentArray.length <= arrayIndex) {
      currentArray.push(null);
    }
    currentArray[arrayIndex] = value;
    return;
  }
  currentObject[leaf] = value;
}

export function removePointer(root: JsonObject, pointer: string): void {
  const segments = splitSegments(pointer);
  if (segments.length === 0) {
    throw new Error('Pointer cannot target document root');
  }

  let current: JsonValue = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] as string;
    if (Array.isArray(current)) {
      current = current[parseArrayIndex(segment)] as JsonValue;
      continue;
    }
    if (!isJsonObject(current)) {
      return;
    }
    current = current[segment] as JsonValue;
  }

  const leaf = segments[segments.length - 1] as string;
  if (Array.isArray(current)) {
    const arrayIndex = parseArrayIndex(leaf);
    if (arrayIndex >= 0 && arrayIndex < current.length) {
      current.splice(arrayIndex, 1);
    }
    return;
  }
  if (!isJsonObject(current)) {
    return;
  }
  delete current[leaf];
}

export function getPointer(
  root: JsonObject,
  pointer: string,
): JsonValue | undefined {
  const segments = splitSegments(pointer);
  if (segments.length === 0) {
    return root;
  }

  let current: JsonValue = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const nextIndex = parseArrayIndex(segment);
      current = current[nextIndex] as JsonValue;
      continue;
    }
    if (!isJsonObject(current)) {
      return undefined;
    }
    current = current[segment] as JsonValue;
  }
  return current;
}
