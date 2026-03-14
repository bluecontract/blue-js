import type { BlueObject, BlueValue } from '../types.js';

const decode = (segment: string): string =>
  segment.replaceAll('~1', '/').replaceAll('~0', '~');

const parsePointer = (pointer: string): string[] => {
  if (pointer === '' || pointer === '/') {
    return [];
  }
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON pointer "${pointer}"`);
  }
  return pointer
    .slice(1)
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(decode);
};

const isIndexSegment = (segment: string): boolean => /^\d+$/.test(segment);

export const setByPointer = (
  target: BlueObject,
  pointer: string,
  value: BlueValue,
): void => {
  const segments = parsePointer(pointer);
  if (segments.length === 0) {
    throw new Error('Cannot replace the root document with setByPointer.');
  }
  let cursor: unknown = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];

    if (Array.isArray(cursor)) {
      const arrayIndex = Number(segment);
      if (!Number.isInteger(arrayIndex)) {
        throw new Error(`Expected numeric array index segment: "${segment}"`);
      }
      if (cursor[arrayIndex] == null) {
        cursor[arrayIndex] = isIndexSegment(nextSegment) ? [] : {};
      }
      cursor = cursor[arrayIndex];
      continue;
    }

    if (typeof cursor !== 'object' || cursor === null) {
      throw new Error(`Cannot navigate pointer "${pointer}"`);
    }

    const objectCursor = cursor as Record<string, unknown>;
    if (objectCursor[segment] == null) {
      objectCursor[segment] = isIndexSegment(nextSegment) ? [] : {};
    }
    cursor = objectCursor[segment];
  }

  const lastSegment = segments[segments.length - 1];
  if (Array.isArray(cursor)) {
    const arrayIndex = Number(lastSegment);
    if (!Number.isInteger(arrayIndex)) {
      throw new Error(`Expected numeric array index segment: "${lastSegment}"`);
    }
    cursor[arrayIndex] = value;
    return;
  }

  if (typeof cursor !== 'object' || cursor === null) {
    throw new Error(`Cannot set value for pointer "${pointer}"`);
  }
  (cursor as Record<string, unknown>)[lastSegment] = value;
};

export const removeByPointer = (target: BlueObject, pointer: string): void => {
  const segments = parsePointer(pointer);
  if (segments.length === 0) {
    return;
  }
  let cursor: unknown = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (Array.isArray(cursor)) {
      cursor = cursor[Number(segment)];
    } else if (typeof cursor === 'object' && cursor !== null) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return;
    }
    if (cursor == null) {
      return;
    }
  }

  const lastSegment = segments[segments.length - 1];
  if (Array.isArray(cursor)) {
    const arrayIndex = Number(lastSegment);
    if (Number.isInteger(arrayIndex)) {
      cursor.splice(arrayIndex, 1);
    }
    return;
  }
  if (typeof cursor === 'object' && cursor !== null) {
    delete (cursor as Record<string, unknown>)[lastSegment];
  }
};
