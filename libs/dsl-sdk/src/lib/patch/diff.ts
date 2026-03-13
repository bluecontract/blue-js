import type { JsonObject, JsonValue } from '../core/types.js';

export type JsonPatchOperation =
  | { op: 'add'; path: string; val: JsonValue }
  | { op: 'remove'; path: string }
  | { op: 'replace'; path: string; val: JsonValue };

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function pathJoin(path: string, segment: string): string {
  if (path === '') {
    return `/${escapePointerSegment(segment)}`;
  }
  return `${path}/${escapePointerSegment(segment)}`;
}

function sortedObjectKeys(object: JsonObject): string[] {
  return Object.keys(object).sort((left, right) => left.localeCompare(right));
}

function deepEqual(left: JsonValue, right: JsonValue): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!deepEqual(left[index] as JsonValue, right[index] as JsonValue)) {
        return false;
      }
    }
    return true;
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    for (const key of leftKeys) {
      if (!deepEqual(left[key] as JsonValue, right[key] as JsonValue)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function diffAtPath(
  original: JsonValue,
  next: JsonValue,
  path: string,
  output: JsonPatchOperation[],
): void {
  if (deepEqual(original, next)) {
    return;
  }

  if (Array.isArray(original) || Array.isArray(next)) {
    output.push({
      op: 'replace',
      path,
      val: structuredClone(next),
    });
    return;
  }

  if (isObject(original) && isObject(next)) {
    const originalKeys = new Set(sortedObjectKeys(original));
    const nextKeys = new Set(sortedObjectKeys(next));

    for (const key of [...originalKeys].sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (nextKeys.has(key)) {
        continue;
      }
      output.push({
        op: 'remove',
        path: pathJoin(path, key),
      });
    }

    for (const key of [...nextKeys].sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (!originalKeys.has(key)) {
        output.push({
          op: 'add',
          path: pathJoin(path, key),
          val: structuredClone(next[key] as JsonValue),
        });
        continue;
      }
      diffAtPath(
        original[key] as JsonValue,
        next[key] as JsonValue,
        pathJoin(path, key),
        output,
      );
    }
    return;
  }

  output.push({
    op: 'replace',
    path,
    val: structuredClone(next),
  });
}

export function diffJsonDocuments(
  original: JsonObject,
  next: JsonObject,
): JsonPatchOperation[] {
  const operations: JsonPatchOperation[] = [];
  diffAtPath(original, next, '', operations);
  return operations;
}
